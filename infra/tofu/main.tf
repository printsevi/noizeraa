# Providers. Credentials come from variables (see variables.tf), which
# should be supplied as TF_VAR_* environment variables or an untracked
# terraform.tfvars — never committed. See README.md.

provider "hcloud" {
  token = var.hcloud_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Hetzner Object Storage's "region" is really its datacenter location
# (fsn1/nbg1/hel1) and the S3 API rejects a CreateBucket whose region
# doesn't match the location implied by the endpoint host
# (LocationConstraintConflict) — so derive it from hetzner_s3_endpoint
# instead of hardcoding a value that can drift out of sync with it.
locals {
  hetzner_s3_region = split(".", replace(var.hetzner_s3_endpoint, "https://", ""))[0]
}

# Hetzner Object Storage is S3-compatible; managed via the aws provider
# pointed at its endpoint rather than at AWS itself. See storage.tf and
# the caveat in README.md about unconfirmed API parity.
provider "aws" {
  region     = local.hetzner_s3_region
  access_key = var.hetzner_s3_access_key
  secret_key = var.hetzner_s3_secret_key

  # Non-AWS endpoint: no STS, no IMDS, no region catalogue, and buckets
  # addressed by path rather than virtual-host.
  skip_credentials_validation = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
  s3_use_path_style           = true

  endpoints {
    s3 = var.hetzner_s3_endpoint
  }
}
