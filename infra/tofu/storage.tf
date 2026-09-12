# Hetzner Object Storage buckets, managed through the aws provider (see
# main.tf). Verify bucket-level API support (versioning, lifecycle,
# conditional writes) against Hetzner's current docs before relying on
# any of this — tech proposal §11.3 flags conditional-write support
# specifically as unconfirmed, which matters if this is ever used for
# Tofu's own remote state locking (it currently isn't; see README.md).

resource "aws_s3_bucket" "media" {
  bucket = "noizera-media-${var.environment}"
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Renditions are regenerable from originals — expire orphaned ones
# rather than keeping them indefinitely (tech proposal §11 "Backups").
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "expire-orphaned-renditions"
    status = "Enabled"

    filter {
      prefix = "renditions/"
    }

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket" "backups" {
  bucket = "noizera-backups-${var.environment}"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}
