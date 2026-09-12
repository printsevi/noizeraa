resource "hcloud_ssh_key" "deploy" {
  name       = "noizera-deploy-${var.environment}"
  public_key = var.ssh_public_key
}

# PGDATA lives on an attached volume, not the VM disk — resizing a
# volume is a live operation, resizing a VM disk is not (tech proposal §11).
resource "hcloud_volume" "pgdata" {
  name     = "noizera-pgdata-${var.environment}"
  size     = 40
  location = "fsn1"
  format   = "ext4"
}

resource "hcloud_server" "app" {
  name         = "noizera-vm-app-${var.environment}"
  server_type  = "cpx32"
  image        = "ubuntu-24.04"
  location     = "fsn1"
  ssh_keys     = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.app.id]
  user_data = templatefile("${path.module}/../cloud-init/app.yaml", {
    ssh_public_key = var.ssh_public_key
  })

  network {
    network_id = hcloud_network.main.id
    ip         = "10.0.0.10"
  }

  depends_on = [hcloud_network_subnet.main]
}

resource "hcloud_server" "db" {
  name         = "noizera-vm-db-${var.environment}"
  server_type  = "cpx22"
  image        = "ubuntu-24.04"
  location     = "fsn1"
  ssh_keys     = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.db.id]
  user_data = templatefile("${path.module}/../cloud-init/db.yaml", {
    ssh_public_key = var.ssh_public_key
  })

  # No public IPv4/IPv6 (tech proposal §11) — reached only via the
  # private network, from vm-app. Outbound goes through vm-app's NAT
  # (network.tf `nat_via_app`, cloud-init/app.yaml), so the route must
  # exist before cloud-init here can install anything.
  public_net {
    ipv4_enabled = false
    ipv6_enabled = false
  }

  network {
    network_id = hcloud_network.main.id
    ip         = "10.0.0.20"
  }

  depends_on = [hcloud_network_subnet.main, hcloud_network_route.nat_via_app, hcloud_server.app]
}

resource "hcloud_volume_attachment" "pgdata" {
  volume_id = hcloud_volume.pgdata.id
  server_id = hcloud_server.db.id
  automount = false
}
