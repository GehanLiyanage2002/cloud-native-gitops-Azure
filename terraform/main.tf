variable "location" {
  default = "eastus"
}

variable "acr_name" {
  
  default = "acrgitopsgehan2026"
}


resource "azurerm_resource_group" "rg" {
  name     = "rg-gitops-aks"
  location = var.location
}

# 2. Azure Virtual Network (VNet) & AKS Subnet
resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-gitops"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  address_space       = ["10.0.0.0/16"]
}

resource "azurerm_subnet" "aks_subnet" {
  name                 = "subnet-aks"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

# 3. Azure Container Registry (ACR)
resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = false # Best practice: Use Managed Identity instead of admin passwords
}

# 4. Azure Kubernetes Service (AKS) Cluster
resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-gitops-cluster"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "aksgitops"
  sku_tier            = "Free" # Free control plane tier for dev/testing

  node_provisioning_profile {
    mode = "Manual"
  }

  default_node_pool {
    name           = "systempool"
    vm_size        = "Standard_D2s_v4" # Cost-effective 2 vCPU, 4GB RAM burstable VM
    vnet_subnet_id = azurerm_subnet.aks_subnet.id
    auto_scaling_enabled = true
    min_count      = 1
    max_count      = 2
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
    service_cidr   = "10.1.0.0/16"
    dns_service_ip = "10.1.0.10"
  }
}

# 5. Grant AKS Kubelet Identity permission to pull images from ACR (Zero Secrets!)
resource "azurerm_role_assignment" "aks_acr_pull" {
  principal_id                     = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = azurerm_container_registry.acr.id
  skip_service_principal_aad_check = true
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "aks_cluster_name" {
  value = azurerm_kubernetes_cluster.aks.name
}