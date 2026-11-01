# Self-Hosting & Deployment Guide

NETRA is designed for versatile self-hosting across local container environments, developer platform-as-a-service (PaaS) clouds, and zero-cost cloud VPS virtual machines.

---

## 1. Deployment Topology Matrix

| Platform | Configuration Source | Ingress Port | Components Deployed | Target Use Case |
|---|---|---|---|---|
| **Local Docker Compose** | `docker-compose.yml` | `8080` (API), `3000` (UI) | Gateway, PostgreSQL 18 (pgvector), Redis 8.0, Mocks, Ops Console | Local development & testing |
| **Railway** | `deploy/paas/railway.toml` | Auto-assigned HTTPS | Gateway + Managed PostgreSQL + Redis | 1-Click developer PaaS |
| **Render** | `deploy/paas/render.yaml` | Auto-assigned HTTPS | Web Service + PostgreSQL + Redis | Blueprint Infrastructure-as-Code |
| **Fly.io** | `deploy/paas/fly.toml` | Edge Anycast IPv4/IPv6 | Edge microVM with auto-scaling | Low-latency edge inference |
| **Vercel** | `deploy/paas/vercel.json` | Global Edge CDN | React 19 Ops Console + API reverse proxy rewrites | Serverless frontend hosting |
| **Cloud VPS (OCI / AWS)** | `deploy/cloud-vps/setup-vps.sh` | `8080`, `3000` | Full containerized stack via Docker Compose | Free-tier cloud production |

---

## 2. Tier 1: Local Docker Compose (Developer Mode)

The multi-container stack includes the core Java 25 gateway, PostgreSQL 18 with `pgvector`, Redis 8.0 Alpine, mock providers (`alpha` on 9001, `beta` on 9002), and the React 19 / Vite 6 Ops Console.

### 2.1 Starting the Stack
```bash
git clone https://github.com/shashankch/netra-llmgateway.git
cd netra-llmgateway

# Build and start all services
docker compose up -d --build
# or using the developer Makefile:
make up
```

### 2.2 Exposed Services & Health Endpoints

- <img src="../assets/icons/react.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Operations Console UI:** `http://localhost:3000`
- <img src="../assets/icons/java.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Core Gateway Data Plane:** `http://localhost:8080/v1/chat/completions`
- <img src="../assets/icons/spring.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Actuator Health & Metrics:** `http://localhost:8080/actuator/health`
- <img src="../assets/icons/postgres.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **PostgreSQL 18 (pgvector):** `localhost:5432` (`user: netra`, `password: netra`, `db: netra_gateway`)
- <img src="../assets/icons/redis.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Redis 8.0:** `localhost:6379`
- <img src="../assets/icons/openai.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Mock Provider Alpha:** `http://localhost:9001`
- <img src="../assets/icons/terminal.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Mock Provider Beta:** `http://localhost:9002`

---

## 3. Tier 2: Developer Platform-as-a-Service (PaaS)

NETRA provides turnkey deployment blueprints in `deploy/paas/` for modern container platforms.

### 3.1 Railway (1-Click Template)

**Configuration Blueprint:** `deploy/paas/railway.toml`

1. Connect your GitHub repository to [Railway](https://railway.app/).
2. Select **Deploy from Repo**. Railway automatically detects the `railway.toml` blueprint, provisioning the Java 25 gateway alongside managed PostgreSQL with pgvector and Redis.
3. Set environment variable: `PORT=8080`.

### 3.2 Render (Blueprint Infrastructure-as-Code)

**Configuration Blueprint:** `deploy/paas/render.yaml`

1. Navigate to **New > Blueprint** in the Render dashboard.
2. Connect your repository. Render automatically provisions:

    * Web service running the Dockerized gateway.
    * Managed PostgreSQL instance with the `vector` extension enabled.
    * Managed Redis instance.

### 3.3 Fly.io (Edge MicroVM)

**Configuration Blueprint:** `deploy/paas/fly.toml`

Deploy globally distributed edge gateway instances:

```bash
fly launch --config deploy/paas/fly.toml
fly deploy
```

### 3.4 Vercel (Ops Console Frontend)

**Configuration Blueprint:** `deploy/paas/vercel.json`

Deploy the React 19 Ops Console to Vercel's global CDN with automatic reverse-proxy rewrites pointing to your hosted gateway:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/v1/:path*", "destination": "https://<your-gateway-host>/v1/:path*" },
    { "source": "/admin/:path*", "destination": "https://<your-gateway-host>/admin/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 4. Tier 3: Zero-Cost Cloud VPS (OCI Always Free & AWS EC2)

Deploy on zero-cost cloud virtual machines (e.g. Oracle Cloud 4 ARM vCPUs / 24GB RAM or AWS EC2 `t4g.small`):

```bash
curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash
```

The bootstrap script automates:

1. System package updates and UFW firewall configuration.
2. Docker Engine and Docker Compose installation.
3. Repository cloning and environment file (`.env`) creation.
4. Container stack launch with health monitoring.

### 4.1 Production Ingress: Zero-Open-Port Cloudflare Tunnel (`cloudflared`)

In production, exposing port `8080` directly to the public internet creates security risks (automated port scanners, DDoS vectors, manual SSL certificate renewal). 

The enterprise gold standard is running a **Zero-Open-Port Cloudflare Tunnel**:

```
[ Application / Vercel ]
           │
           ▼ (HTTPS / TLS 1.3)
[ Cloudflare Global Edge (Anycast DNS + DDoS + WAF) ]
           │
           ▼ (Persistent Outbound Encrypted Tunnel)
[ cloudflared daemon on VPS ]
           │
           ▼ (localhost / Docker network)
[ NETRA Gateway (:8080) ]
```

#### Why Cloudflare Tunnel is Superior:
- **Zero Inbound Open Ports:** You can close inbound port 8080 entirely on your OCI Security List / AWS Security Group. The `cloudflared` daemon creates an **outbound-only** connection to Cloudflare's nearest edge data center.
- **Origin IP Masking:** Your VPS IP address is never exposed in DNS or HTTP headers, making origin IP-targeted DDoS attacks impossible.
- **Free Automatic SSL & DDoS Protection:** Cloudflare terminates TLS at edge nodes worldwide with zero certbot or renewal maintenance.

#### Cloudflare Tunnel Ingress via Docker Compose (100% Zero-Cost & Containerized)

In production cloud environments, avoid polluting the host OS with package managers or systemd units. NETRA integrates `cloudflared` directly inside `docker-compose.yml` using Docker Compose profiles.

**1. Automated Deployment with Tunnel (Zero Inbound Open Ports):**
```bash
curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash -s -- <YOUR_CLOUDFLARE_TUNNEL_TOKEN>
```

**2. Or toggle on an existing instance:**
```bash
CLOUDFLARE_TUNNEL_TOKEN="<your-tunnel-token>" docker compose --profile tunnel up -d
```

#### 3-Step Free Cloudflare Zero Trust Setup (100% Free Tier, $0 Incurred):
1. **Free Account:** Log in to the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) (100% free for up to 50 users with unlimited bandwidth, zero credit card required).
2. **Create Tunnel:** Navigate to **Networks > Tunnels** &rarr; click **Create a Tunnel** &rarr; select **Cloudflared** &rarr; name it `netra-gateway`.
3. **Configure Ingress Route:** In the **Public Hostname** tab, route your subdomain:
   - **Service Type:** `HTTP`
   - **URL:** `gateway:8080` (or `localhost:8080`)
   - Click **Save Hostname**. Cloudflare automatically issues and manages free SSL certificates with global edge DDoS mitigation.

---

## 5. Post-Deployment Verification Drills

Once deployed, verify gateway integrity and contract adherence using both the standard starter suite (v1) and the enterprise-grade testing suite (v2):

### 5.1 Starter Contract Suite (v1)

```bash
# 1. Run the smoke test suite (17 contract checks)
python3 scripts/smoke_test.py --url http://localhost:8080 --key netra-sk-search-1a2b3c --model fast

# 2. Run the concurrency load test (0 over-admissions)
python3 scripts/load_test.py --url http://localhost:8080 --key netra-sk-free-7g8h9i \
    --model fast --requests 30 --concurrency 10 --rpm-limit 10

# 3. Run the prompt difficulty routing eval (20 benchmark cases)
python3 scripts/run_routing_eval.py --url http://localhost:8080 --key netra-sk-research-4d5e6f

# 4. Run the semantic vector cache evaluation
python3 scripts/run_cache_eval.py --url http://localhost:8080 --key netra-sk-search-1a2b3c
```

### 5.2 Enterprise Hardening Suite (v2)

For deep stress testing, socket drop resilience, and adversarial cache fuzzing:

```bash
# 5. High-Concurrency Stress Test (TPS vs. RPS, TTFT percentiles)
python3 scripts/v2/stress_test.py --url http://localhost:8080 --key netra-sk-search-1a2b3c \
    --concurrency 25 --duration 10 --model fast

# 6. Chaos & Resilience Drill (Client socket drops, budget limits, vector faults)
python3 scripts/v2/chaos_drill.py --url http://localhost:8080 --key netra-sk-free-7g8h9i

# 7. Semantic Cache Adversarial Fuzzer (Refusal suppression, tenant leakage probes)
python3 scripts/v2/cache_fuzzer.py --url http://localhost:8080 --key netra-sk-search-1a2b3c
```

For detailed empirical benchmark logs and reconciliation matrices, see the [Engineering Verification & Benchmark Report](verification-report.md).
