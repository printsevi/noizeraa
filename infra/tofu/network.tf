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

# vm-db has no public IP (servers.tf), so its outbound traffic — apt,
# the PGDG repo, pgBackRest pushing to object storage — is NATed through
# vm-app: this route sends the subnet's default traffic to vm-app's
# private IP, and cloud-init/app.yaml enables forwarding + masquerade
# there. Hetzner's documented pattern for private-only servers.
resource "hcloud_network_route" "nat_via_app" {
  network_id  = hcloud_network.main.id
  destination = "0.0.0.0/0"
  gateway     = "10.0.0.10"
}

# vm-app: 80/443 open to the world (fronted by Cloudflare in practice —
# tech proposal §11.2), 22 restricted to the admin IP as break-glass.
# Routine SSH (CI deploys, day-to-day admin) goes over Tailscale
# (ADR 001), which never touches the public interface.
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

  # Tailscale's WireGuard transport; UDP 41641 inbound is optional (it
  # can traverse NAT via DERP) but a direct path is cheaper and faster.
  rule {
    direction  = "in"
    protocol   = "udp"
    port       = "41641"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

# Hetzner Cloud Firewalls filter the PUBLIC interface only — they do not
# apply to private-network traffic. vm-db has no public interface, so a
# firewall attached to it is inert; it exists so that if a public IP is
# ever added by mistake, nothing but nothing is reachable. The real
# controls on vm-db are Postgres `listen_addresses` on the private IP,
# pg_hba restricted to 10.0.0.10, and ufw on the host
# (docs/tickets/001-vm-db-bootstrap.md).
resource "hcloud_firewall" "db" {
  name = "noizera-db-${var.environment}"
  # No rules: default deny on any public interface.
}
