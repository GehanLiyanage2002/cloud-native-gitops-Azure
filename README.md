# Cloud-Native GitOps Microservices Platform on Azure (AKS, Terraform & ArgoCD)

![Microsoft Azure](https://img.shields.io/badge/Microsoft_Azure-0089D6?style=for-the-badge&logo=microsoft-azure&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)
![Kubernetes](https://img.shields.io/badge/AKS_Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![ArgoCD](https://img.shields.io/badge/ArgoCD-EF7B4D?style=for-the-badge&logo=argo&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

An end-to-end, self-healing **Cloud-Native GitOps deployment platform** built on **Microsoft Azure**. This project provisions cloud infrastructure declaratively using **Terraform** and deploys a containerized 2-tier **React & Node.js telemetry web application** onto **Azure Kubernetes Service (AKS)** using **GitHub Actions** (CI) and **ArgoCD** (Pull-based CD).

The web application queries live Kubernetes pod metadata (`os.hostname()`, container uptime, and readiness health checks), visually demonstrating real-time load balancing and zero-downtime rolling updates across pod replicas.

---

## System Architecture

```mermaid
flowchart TB
    subgraph Dev["Developer Workflow"]
        Code["Code Push (main)"]
    end

    subgraph CI["GitHub Actions (Continuous Integration)"]
        Build["Multi-Stage Docker Build"]
        Tag["Tag with Immutable Git SHA"]
        UpdateYAML["Update Image Tag in k8s/*.yaml"]
    end

    subgraph AzureCloud["Microsoft Azure Cloud (eastus)"]
        Blob["Azure Blob Storage\n(Remote Terraform State + Lease Lock)"]
        ACR["Azure Container Registry (ACR)\nacrgitopsgehan2026.azurecr.io"]

        subgraph VNet["Azure Virtual Network (10.0.0.0/16)"]
            LB["Azure Standard Load Balancer\n(Public External IP)"]

            subgraph AKS["Azure Kubernetes Service (AKS Cluster)"]
                Argo["ArgoCD Controller\n(Pull-Based GitOps Sync & Self-Heal)"]

                subgraph FrontendSvc["Frontend Deployment (2 Replicas)"]
                    Nginx1["React + Nginx Reverse Proxy Pod 1"]
                    Nginx2["React + Nginx Reverse Proxy Pod 2"]
                end

                subgraph BackendSvc["Backend ClusterIP Service (Internal Only)"]
                    Node1["Node.js API Pod 1\n(/api/info & /healthz)"]
                    Node2["Node.js API Pod 2\n(/api/info & /healthz)"]
                end
            end
        end
    end

    Terraform["Terraform IaC"] -->|Provisions & Locks State| Blob
    Terraform -->|Provisions VNet, ACR, AKS & RBAC| AzureCloud

    Code --> Build --> Tag
    Tag -->|Push Image| ACR
    Tag --> UpdateYAML
    UpdateYAML -->|Git Commit [skip ci]| Argo

    Argo -->|Watches k8s/ Manifests| UpdateYAML
    Argo -->|Deploys & Reconciles State| FrontendSvc
    Argo -->|Deploys & Reconciles State| BackendSvc
    AKS -.->|Passwordless AcrPull via Managed Identity| ACR

    LB -->|HTTP :80| Nginx1 & Nginx2
    Nginx1 & Nginx2 -->|Internal DNS Proxy /api/* :5000| Node1 & Node2
```

---

## Key Architectural & Engineering Decisions

### 1. Strict CI vs. CD Separation (Pull-Based GitOps)
Instead of storing cluster admin credentials (`kubeconfig`) inside GitHub Actions and running `kubectl apply` from an external runner, the CI pipeline only builds container artifacts, pushes them to **Azure Container Registry (ACR)**, and commits the updated image SHA back to the `k8s/` manifest folder. **ArgoCD** runs inside the AKS cluster, continuously watches the Git repository, and pulls changes inward—eliminating external cluster credential exposure and preventing configuration drift via `selfHeal: true`.

### 2. Passwordless ACR-to-AKS Authentication (`AcrPull` Managed Identity)
Legacy setups enable the ACR Admin User and store static registry passwords in Kubernetes `imagePullSecrets`. In this architecture, `admin_enabled` is set to `false` on ACR. Instead, Terraform binds an Azure RBAC `AcrPull` role assignment directly to the AKS cluster's System-Assigned Kubelet Managed Identity (`kubelet_identity`), allowing nodes to pull private images without secrets or credential rotation overhead.

### 3. FinOps & Network Security via Internal Nginx Reverse Proxy
Provisioning separate cloud Load Balancers for frontend and backend services doubles networking costs and exposes internal APIs to the public internet. Here, only the `frontend-service` is exposed via an Azure `LoadBalancer`. The frontend container runs **Nginx**, serving compiled React static files on `/` and reverse-proxying `/api/*` requests over internal Kubernetes DNS (`http://backend-service:5000`) to the private `ClusterIP` backend.

### 4. Immutable Artifact Tagging & Zero-Downtime Probes
Using the mutable `:latest` Docker tag makes rollbacks unreliable. Every CI run tags images with the 7-character Git commit SHA (`${SHORT_SHA}`), providing 1-to-1 traceability between running pods and source commits. Both deployments run 2 replicas governed by Kubernetes `livenessProbe` and `readinessProbe` checks on `/healthz`.

---

## Project Repository Structure

```text
cloud-native-gitops-azure/
├── .github/
│   └── workflows/
│       └── ci-gitops.yml        # GitHub Actions CI + ACR Push + GitOps Manifest Updater
├── app/
│   ├── backend/                 # Node.js Express Telemetry API
│   │   ├── server.js
│   │   ├── package.json
│   │   └── Dockerfile           # Non-root Alpine container build
│   └── frontend/                # React (Vite) Dashboard + Nginx Reverse Proxy
│       ├── index.html
│       ├── package.json
│       ├── vite.config.js
│       ├── nginx.conf           # Internal proxy_pass to http://backend-service:5000
│       ├── Dockerfile           # Multi-stage Node builder -> Nginx 1.27-alpine runtime
│       └── src/
│           ├── main.jsx
│           └── App.jsx
├── terraform/                   # Declarative Azure Infrastructure as Code
│   ├── backend.tf               # Azure Blob Storage remote state with native lease locking
│   └── main.tf                  # Resource Group, VNet, Subnet, ACR, AKS & AcrPull RBAC
└── k8s/                         # Declarative Kubernetes Manifests (Watched by ArgoCD)
    ├── backend-deployment.yaml  # 2 Replicas + Liveness/Readiness Probes + ClusterIP
    ├── frontend-deployment.yaml # 2 Replicas + Azure LoadBalancer Service
    └── argocd-application.yaml  # ArgoCD Automated Sync & Self-Healing CR
```

---

## Live Deployment Screenshots

> *(Replace the paths below with screenshots captured from your environment)*

| Live React Pod Telemetry Dashboard | ArgoCD Healthy Sync Tree |
| :---: | :---: |
| ![React Dashboard](docs/screenshots/dashboard-load-balancing.png) | ![ArgoCD UI](docs/screenshots/argocd-synced.png) |
| *Refreshing the UI alternates `podHostname` across AKS replicas* | *ArgoCD reconciling live AKS cluster state with Git* |

---

## Production Troubleshooting & Engineering Log

While building and deploying this infrastructure on Azure, I encountered and resolved three real-world cloud and Kubernetes issues:

### Issue 1: `409 Conflict (MissingSubscriptionRegistration)` During `terraform apply`
* **Symptom:** Provisioning failed immediately after creating the Resource Group with `MissingSubscriptionRegistration: The subscription is not registered to use namespace 'Microsoft.Network'` and `'Microsoft.ContainerRegistry'`.
* **Root Cause:** Starting in `hashicorp/azurerm` v4.0+, automatic Resource Provider registration was disabled by default to reduce Azure Resource Manager API latency during `terraform plan`. On a clean subscription, core compute and networking namespaces remain unregistered until explicitly activated.
* **Resolution:** Pre-registered the required Azure resource providers via the Azure CLI and verified their state reached `Registered` before re-running `terraform apply`:
  ```bash
  az provider register --namespace Microsoft.Network
  az provider register --namespace Microsoft.ContainerRegistry
  az provider register --namespace Microsoft.ContainerService
  az provider register --namespace Microsoft.Compute
  ```

### Issue 2: `400 BadRequest` Regional VM SKU Capacity Restrictions (`Standard_B2s` Disallowed)
* **Symptom:** AKS cluster creation failed in `southeastasia` and `eastus` because the burstable `Standard_B2s` SKU was restricted by subscription policy in those regions.
* **Root Cause:** Azure enforces regional SKU restrictions on general-purpose and burstable VM families depending on subscription tier and datacenter capacity.
* **Resolution:** Inspected the allowed SKU list returned by the Azure Resource Manager API and migrated the infrastructure to `eastus` using `Standard_D2s_v4` (2 vCPUs, 8 GB RAM) with autoscaling capped at `max_count = 2` to stay safely within regional vCPU quotas.

### Issue 3: Kubernetes `ErrImagePull (401 Unauthorized)` & ACR `TasksOperationsNotAllowed`
* **Symptom:** Initial backend pods entered `ErrImagePull` with a trailing `401 Unauthorized` error in the `containerd` RPC trace, and running `az acr build` failed with `TasksOperationsNotAllowed`.
* **Root Cause:** 
  1. Inspecting the full `containerd` log revealed two sequential errors: the first request authenticated via Managed Identity and returned `NotFound` because the bootstrap `:initial` image had not been pushed yet. When `containerd` receives `NotFound` from a private registry, it retries anonymously, triggering the misleading `401 Unauthorized`.
  2. Azure restricts serverless ACR cloud build tasks (`az acr build`) on student/trial subscriptions.
* **Resolution:** Authenticated the local Docker daemon directly against ACR using `az acr login`, built and pushed the multi-stage `:initial` images, and executed `kubectl rollout restart deployment` to transition all pods to `1/1 Running` while preserving passwordless Managed Identity authentication.

---

## How to Reproduce & Deploy

### Prerequisites
* Azure CLI (`az`), Terraform (`>= 1.7.0`), `kubectl`, and Docker Desktop installed.

### 1. Bootstrap Remote Terraform State in Azure Blob Storage
```bash
az group create --name rg-terraform-state --location southeastasia
az storage account create --name gehanstfstate2026 --resource-group rg-terraform-state --location southeastasia --sku Standard_LRS
az storage container create --name tfstate --account-name gehanstfstate2026
```

### 2. Provision Azure VNet, ACR, and AKS with Terraform
```bash
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
cd terraform
terraform init
terraform apply -auto-approve

# Connect local kubectl to the new AKS cluster
az aks get-credentials --resource-group rg-gitops-aks --name aks-gitops-cluster --overwrite-existing
kubectl get nodes
```

### 3. Build & Push Initial Bootstrap Images to ACR
```bash
cd ..
az acr login --name acrgitopsgehan2026

docker build -t acrgitopsgehan2026.azurecr.io/gitops-backend:initial ./app/backend
docker push acrgitopsgehan2026.azurecr.io/gitops-backend:initial

docker build -t acrgitopsgehan2026.azurecr.io/gitops-frontend:initial ./app/frontend
docker push acrgitopsgehan2026.azurecr.io/gitops-frontend:initial
```

### 4. Install ArgoCD & Enable Automated GitOps Sync
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f [https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml](https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml)
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s

# Deploy the ArgoCD Application CR
kubectl apply -f k8s/argocd-application.yaml

# Retrieve external Azure LoadBalancer IP
kubectl get svc frontend-service
```

### 5. FinOps Cleanup (Prevent Idle Cloud Billing)
```bash
# Pause cluster compute when not in use:
az aks stop --name aks-gitops-cluster --resource-group rg-gitops-aks

# Or tear down all provisioned infrastructure cleanly:
cd terraform && terraform destroy -auto-approve
```

---

## Author

**Gehan Chamikara Liyanage**  
* 🌐 Portfolio: [gehanliyanage.site](https://gehanliyanage.site)  
* 💻 GitHub: [@GehanLiyanage2002](https://github.com/GehanLiyanage2002)
