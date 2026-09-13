variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token (Zone:DNS:Edit, Zone:Zone:Read on the noizera.com zone)"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the primary domain"
  type        = string
}

variable "hetzner_s3_access_key" {
  description = "Hetzner Object Storage access key"
  type        = string
  sensitive   = true
}

variable "hetzner_s3_secret_key" {
  description = "Hetzner Object Storage secret key"
  type        = string
  sensitive   = true
}

variable "hetzner_s3_endpoint" {
  description = "Hetzner Object Storage S3-compatible endpoint for the target region"
  type        = string
  default     = "https://nbg1.your-objectstorage.com"
}

variable "db_app_password" {
  description = "Password for the app's Postgres role on vm-db (also goes into infra/compose/.env.enc as part of DATABASE_URL — the two must be kept in sync by hand, see docs/tickets/001-vm-db-bootstrap.md)"
  type        = string
  sensitive   = true
}

variable "ssh_public_key" {
  description = "Public key installed for the deploy user on both VMs"
  type        = string
}

variable "admin_ip" {
  description = "IP (CIDR, e.g. 203.0.113.4/32) allowed to SSH to vm-app"
  type        = string
}

variable "domain" {
  description = "Primary domain"
  type        = string
  default     = "noizera.com"
}

variable "environment" {
  description = "Deployment environment name, used in resource names/labels"
  type        = string
  default     = "production"
}
