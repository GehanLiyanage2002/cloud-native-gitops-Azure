terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "gehanstfstate2026" # Replace with your storage account name
    container_name       = "tfstate"
    key                  = "gitops-aks.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
  # Tip: Export ARM_SUBSCRIPTION_ID in your terminal, or uncomment below:
  # subscription_id = "your-azure-subscription-id"
}