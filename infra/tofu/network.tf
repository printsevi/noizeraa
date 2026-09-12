resource "hcloud_network" "main" {
  name     = "noizera-${var.environment}"
  ip_range = "10.0.0.0/16"
}

resource "hcloud_network_subnet" "main" {
  network_id   = hcloud_network.main.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = "10.0.0.0/24"
}

# vm-app: 80/443 open to the world (fronted by Cloudflare in practice —
# tech proposal §11.2), 22 restricted to the admin IP.
resource "hcloud_firewall" "app" {
  name = "noizera-app-${var.environment}"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = [var.admin_ip]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

# vm-db has no public IP at all (see servers.tf), so this firewall is
# defense in depth on the private interface, not the primary control.
# Administer vm-db by SSHing to vm-app first, then to vm-db over the
# private network (tech proposal §11).
resource "hcloud_firewall" "db" {
  name = "noizera-db-${var.environment}"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "5432"
    source_ips = ["10.0.0.0/24"]
  }
}
