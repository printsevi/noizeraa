output "app_ipv4" {
  value = hcloud_server.app.ipv4_address
}

output "db_private_ip" {
  value = "10.0.0.20"
}

output "media_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "backups_bucket" {
  value = aws_s3_bucket.backups.bucket
}
