# Providers. Credentials come from variables (see variables.tf), which
# should be supplied as TF_VAR_* environment variables or an untracked
# terraform.tfvars — never committed. See README.md.

provider "hcloud" {
  token = var.hcloud_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Hetzner Object Storage is S3-compatible; managed via the aws provider
# pointed at its endpoint rather than at AWS itself. See storage.tf and
# the caveat in README.md about unconfirmed API parity.
provider "aws" {
  region                      = "eu-central-1"
  access_key                  = var.hetzner_s3_access_key
  secret_key                  = var.hetzner_s3_secret_key
  skip_credentials_validation = true
  skip_region_validation      = true
  skip_requesting_account_id  = true

  endpoints {
    s3 = var.hetzner_s3_endpoint
  }
}
