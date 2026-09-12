# Cloudflare owns authoritative DNS (tech proposal §11.2). The app
# hostnames are proxied (orange-cloud); the custom-domain edge hostname
# and mail records are DNS-only.

resource "cloudflare_record" "root" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "A"
  content = hcloud_server.app.ipv4_address
  proxied = true
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "A"
  content = hcloud_server.app.ipv4_address
  proxied = true
}

# Deliberately NOT proxied, so Caddy's on-demand TLS sees a real HTTP-01
# challenge for customer custom domains that CNAME here (tech proposal §11.2).
resource "cloudflare_record" "edge" {
  zone_id = var.cloudflare_zone_id
  name    = "edge"
  type    = "A"
  content = hcloud_server.app.ipv4_address
  proxied = false
}

# Mail — dedicated subdomain, per tech proposal §9. The MX and DKIM
# values below are placeholders: Brevo issues the real ones at sending-
# domain setup time, they are not something to invent.
resource "cloudflare_record" "mail_mx" {
  zone_id  = var.cloudflare_zone_id
  name     = "mail"
  type     = "MX"
  content  = "REPLACE_WITH_BREVO_MX_TARGET"
  priority = 10
}

resource "cloudflare_record" "mail_spf" {
  zone_id = var.cloudflare_zone_id
  name    = "mail"
  type    = "TXT"
  content = "v=spf1 include:spf.brevo.com ~all"
}

resource "cloudflare_record" "mail_dmarc" {
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc.mail"
  type    = "TXT"
  content = "v=DMARC1; p=quarantine; rua=mailto:dmarc@${var.domain}"
}

resource "cloudflare_record" "mail_dkim" {
  zone_id = var.cloudflare_zone_id
  name    = "brevo._domainkey.mail"
  type    = "TXT"
  content = "REPLACE_WITH_BREVO_DKIM_VALUE"
}
