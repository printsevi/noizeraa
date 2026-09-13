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
#
# On first apply against Hetzner, this resource's PUT succeeds but the
# provider's post-write read-back waiter times out after 3 minutes
# (Hetzner's Object Storage doesn't seem to reflect the change on the
# same timeline AWS S3 does) — the rule was confirmed present via a
# direct signed GET regardless, and imported into state rather than
# re-applied. `transition_default_minimum_object_size` is a newer
# provider-side default with no equivalent in Hetzner's response, so
# it perpetually drifts; ignored here so a routine `apply` never
# re-triggers that same timeout by trying to "fix" it.
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

  lifecycle {
    ignore_changes = [transition_default_minimum_object_size]
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
