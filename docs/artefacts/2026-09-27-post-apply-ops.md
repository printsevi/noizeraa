# Post-apply ops: Tailscale join, a silent cloud-init failure on both VMs, and pgAdmin over the tailnet

Follow-on session to `2026-09-12-project-setup.md` §13 (the first real `tofu apply`). This one picked up "how do I actually reach `noizera.com`" and ended up finding that neither VM's `cloud-init` had actually finished what it was supposed to — invisible from `cloud-init status` alone.

## 1. Joining vm-app to the tailnet: a fresh tailnet has no tags yet

ADR 001 assumes `tag:server`/`tag:ci` already exist. On a brand-new tailnet signup they don't — `tailscale up --advertise-tags=tag:server` fails with `requested tags [tag:server] are invalid or not permitted` until a `tagOwners` block naming who can grant those tags is added to the tailnet's ACL policy (Access Controls in the admin console). Non-obvious the first time; obvious in hindsight from the error text.

**Reusable takeaway:** when adopting ADR 001's Tailscale pattern on a new tailnet, add the ACL's `tagOwners` (and the `tag:ci → tag:server:22` grant) as an explicit first step, not something discovered via a failed `tailscale up`.

## 2. A firewall red herring: `ufw` looked right, wasn't the problem

vm-db was unreachable from vm-app on port 22/5432 (timeout), but ping worked. The instinct was to suspect `ufw` (Ubuntu 24.04 defaults it to an nftables backend, and `iptables -L` doesn't show the `ufw-user-input` chain the way older setups do, which looked suspicious). Disabling `ufw` entirely and retesting still timed out — proving it was never the cause. The decisive test was `tcpdump -i any port 22` on vm-db showing **zero packets arriving**, then the same capture on vm-app's own interface showing the SYN going out **`eth0` (public IP) instead of the private NIC**.

Root cause: vm-app's private-network interface (`enp7s0`) existed (visible in `ip addr`) but was down with no IP — so the kernel had no route to `10.0.0.0/24` and fell back to the default route. A private destination sent out the public interface gets silently black-holed (not locally rejected), which is why it read as a network problem rather than a routing misconfiguration. ICMP still "worked" in the sense that a ping to 10.0.0.20 returned — worth treating that as inconclusive rather than proof of a healthy path; it didn't rule out the actual fault.

Fix: reboot vm-app. `cloud-init`/netplan re-detects all currently-attached NICs at boot; the private network was likely attached a moment after the VM's first boot (a Terraform ordering/timing artifact), so the one-shot first-boot network config never saw it. A reboot re-runs that detection against the network as it exists _now_.

**Reusable takeaway:** "ping works" only proves L3 reachability for ICMP specifically — it doesn't prove routing is correct in general, especially right after a VM's private network was attached. If TCP times out while ICMP succeeds, suspect an interface/route problem before a firewall, and confirm with `tcpdump` on both ends (source IP/interface in the capture tells you immediately which path traffic is actually taking) rather than reasoning from `ufw status` alone.

## 3. The same bug, worse consequences, on vm-db — a whole `runcmd` silently skipped

Once vm-app's route was fixed, port 22 to vm-db still refused/timed out intermittently while investigating — and separately, once SSH did work, Postgres itself refused connections. `cloud-init status --long` reported `done`. `dpkg -l | grep postgres` showed **nothing installed at all**. The actual cause, found in `/var/log/cloud-init-output.log`: `apt-get update` hit `Temporary failure resolving 'archive.ubuntu.com'` during boot (vm-db's own network wasn't ready — same class of bug as §2, or the NAT path through vm-app wasn't up yet), which failed silently and took `postgresql-17`, `pgbackrest`, and `fail2ban` down with it. `cloud-init` does not abort `runcmd` on a single failing command, so the rest of the script (PGDATA relocation, `pg_hba` edit, role/database bootstrap, pgBackRest stanza) all failed downstream in a cascade, and cloud-init still happily reports `done` at the end.

Remediated by hand rather than by re-running `cloud-init` (it's one-shot; there's no clean "retry" primitive for a partially-completed `runcmd`):

- Re-fetched the PGDG GPG key (the original `curl` also failed for the same DNS reason) and re-ran `apt-get update`/`install`.
- `postgresql-17`'s postinst refused to auto-create a cluster twice over: first because `/etc/postgresql/17/main` already existed (created by `cloud-init`'s `write_files` phase, which — unlike `runcmd` — isn't network-dependent, so our custom `conf.d/99-noizera-tuning.conf` and the `pg_hba.conf` line from `runcmd`'s one `echo` that _did_ succeed were both still sitting there); then, after clearing that stub aside, because current PGDG packaging disables automatic cluster creation by default (`pg_createcluster 17 main` has to be run explicitly).
- The attached data volume, already correctly mounted at `/var/lib/postgresql/17/main` via the `fstab` entry `runcmd` had managed to write, had a stray `lost+found` directory from `mkfs.ext4` that blocked `initdb` (`directory exists but is not empty`) — removing it (nothing else was in there) let `initdb` proceed directly onto the volume as intended.
- Merged the surviving custom `pg_hba` line and tuning conf into the freshly created cluster, restarted, then created the pgBackRest stanza and confirmed a real WAL push to the S3 backup bucket succeeded — `pgbackrest check` isn't just a config lint, it round-trips through the actual repo.
- Created the `noizera` role/database. First attempt at this specifically over a scripted SSH command produced `password authentication failed` — Postgres gives that exact same generic message whether the role is missing or the password is wrong (a deliberate anti-enumeration choice), which was momentarily misleading. The real cause: the shell variable used to smuggle the password out of `terraform.tfvars` came back empty from a `grep`/`sed` one-liner. Redone with the user typing `CREATE ROLE ... PASSWORD '...'` directly at an interactive `psql` prompt — no shell interpolation, no ambiguity about what value actually got set.

**Reusable takeaway:** `cloud-init status: done` means "every command in `runcmd` was attempted," not "every command succeeded." After any first real boot, verify what the script was actually supposed to install actually landed (`dpkg -l`, `systemctl list-units | grep <expected-service>`) rather than trusting the overall status. If a VM depends on egress that only becomes available once its own network config finishes (as both of these VMs do — vm-db doubly so, since it also depends on vm-app's NAT), a network-dependent `apt-get update` at the top of `runcmd` is a single point of failure worth guarding with a retry loop or an explicit wait-for-network step, especially since the failure mode (silent, partial, "done" anyway) is unusually hard to notice without knowing to look.

## 4. pgAdmin: Tailscale-only, not a Cloudflare-fronted subdomain

Wanted a GUI for vm-db. The instinctive first framing ("what cert do I need for it") was the wrong question — ADR 001 already established that admin surfaces on this estate go over Tailscale, not the public interface, specifically to avoid a bigger attack surface than the SSH access it explicitly gates. A DB admin UI is a bigger attack surface than SSH, so the same reasoning applies more strongly, not less. Landed on: a standalone `docker-compose.admin.yml` (deliberately not part of the CI-deployed `docker-compose.yml`), pgAdmin's port bound to vm-app's own Tailscale IP specifically (`${TAILSCALE_IP}:5050:80`, never `0.0.0.0`) — no public DNS record, no Cloudflare proxying, no cert of any kind needed, since the tailnet's WireGuard tunnel already encrypts it end to end.

**Reusable takeaway:** when a new admin/ops tool comes up mid-project, check whether an existing ADR already answered "how should admin access to this estate work" before treating it as a fresh cert/exposure decision — re-deriving the same answer (Tailscale over public) from scratch is a waste of a round-trip, and skipping the check risks a _worse_ answer (a public pgAdmin) than the one already established for a _lower_-risk surface (SSH).

## 5. Losing the age keypair cost nothing, because nothing had used it yet

Asked to encrypt the Origin CA cert's private key with the project's existing age keypair (per ticket 002) — but the original, from the 2026-09-12 session, wasn't recoverable (lost locally; per that session's own security note, `SOPS_AGE_KEY`/`SOPS_AGE_PUBLIC_KEY` were meant to go straight into GitHub secrets from the user's local generation, but never actually got set there). Before treating this as a real incident: checked `gh secret list` (empty) and searched the repo for any `terraform.tfstate.enc`/`.env.enc` (none exist). Nothing had ever actually been encrypted with the lost keypair, so generating a fresh one cost nothing — no ciphertext became unrecoverable. Set the two GitHub secrets from the new keypair immediately, so this doesn't drift again.

**Reusable takeaway:** before treating a "lost credential" as an incident requiring rotation-with-consequences, check whether anything was actually encrypted/signed with it yet — for a keypair that's supposed to gate a system nobody has started depending on, losing it is a non-event, not a rotation.

## 6. Browser-console keyboard mapping mangled characters silently

Working over Hetzner's browser-based server console (needed for anything that requires being on the box before SSH works, or for an out-of-band root-password reset) hit repeated small corruptions: a typed `-` /number combo came out as `-i`, a hyphenated command name lost its hyphen, and a `|` pipe character was dropped outright (making `ss -tlnp | grep :22` parse as `ss -tlnp grep :22` and fail confusingly). None of these were told apart from "real" errors until re-typed slowly or rephrased to avoid the character class involved (e.g., writing output to a file and using `grep`/`sed` with a filename argument instead of a pipe).

**Reusable takeaway:** when a command run through a browser-based console fails with a bizarre parse error that wouldn't make sense from the command as written, suspect the console's keyboard/clipboard layer before the command or the remote system — retype it, or restructure to avoid the specific character class (pipes, hyphens) that broke.

## 7. A guardrail against agent-run production data reads

Two attempts to run a read-only `psql` query (`\l`, `\du`) against vm-db directly from this session were blocked by Claude Code's own auto-mode classifier ("Production Reads"), even piped through an SSH hop rather than run locally. Worked around by having the user run the same read-only commands themselves and paste back the output. Purely operational connectivity checks (`nc`, `ping`, `tcpdump`, `systemctl status`) were not blocked — only the actual data-bearing query.

**Reusable takeaway:** expect this class of guardrail on any live production database, and route data-reading diagnostics through the user rather than treating the block as something to route around. It doesn't cover schema/service-status checks, so there's usually still a productive path forward without the blocked query.
