# Self-Hosting & Deployment Guide

NETRA is designed for versatile self-hosting across local, cloud VM, and platform-as-a-service environments.

---

## Tier 1: Local Docker Compose (Developer Mode)

The fastest way to deploy NETRA locally:

```bash
git clone https://github.com/shashankch/netra-llmgateway.git
cd netra-llmgateway
make up
```

Services exposed:
- Gateway API: `http://localhost:8080`
- PostgreSQL 18: `localhost:5432` (`netra / netra`)
- Redis 8.0: `localhost:6379`
- Mock Provider Alpha: `http://localhost:9001`
- Mock Provider Beta: `http://localhost:9002`

---

## Tier 2: Developer PaaS (1-Click Deployment)

Pre-configured deployment descriptors are located in `deploy/paas/`:

- **Railway:** Template provided in `deploy/paas/railway.toml`.
- **Render:** Blueprint specification in `deploy/paas/render.yaml`.
- **Fly.io:** MicroVM configuration in `deploy/paas/fly.toml`.

---

## Tier 3: Zero-Cost Cloud VPS (OCI & AWS Free Tier)

Provision a zero-cost cloud instance (e.g. Oracle Cloud 4 ARM vCPUs / 24GB RAM or AWS EC2 `t4g.small`):

```bash
curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash
```

This automated script installs Docker, configures UFW firewall rules, clones the repository, and starts the containerized gateway stack.
