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
| **Production Cloud VM & VPS** | `deploy/cloud-vps/setup-vps.sh` | `8080`, `3000` | Full containerized stack via Docker Compose | Production VPS & cloud VM |

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

- <img src="assets/icons/react.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Operations Console UI:** `http://localhost:3000`
- <img src="assets/icons/java.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Core Gateway Data Plane:** `http://localhost:8080/v1/chat/completions`
- <img src="assets/icons/spring.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Actuator Health & Metrics:** `http://localhost:8080/actuator/health`
- <img src="assets/icons/postgres.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **PostgreSQL 18 (pgvector):** `localhost:5432` (`user: netra`, `password: netra`, `db: netra`)
- <img src="assets/icons/redis.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Redis 8.0:** `localhost:6379`
- <img src="assets/icons/openai.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Mock Provider Alpha:** `http://localhost:9001`
- <img src="assets/icons/terminal.svg" width="16" height="16" style="vertical-align: middle; margin-right: 4px;"> **Mock Provider Beta:** `http://localhost:9002`

!!! tip "Port Allocation & Local vLLM Drills"
    The Zensical documentation preview server (`make docs-serve`) binds to port 8000 by default. If testing with an in-VPC vLLM instance locally on port 8000, specify an alternate port (`zensical serve --dev-addr 127.0.0.1:8008`) or route to `VLLM_BASE_URL=http://localhost:8001/v1`.

### 2.3 Operations Console UI Deployment & Serving

The React 19 Ops Console (`console/`) can be served via Docker Compose, standalone Node/Vite, or static edge hosting:

#### Option A: Docker Compose (Default Nginx Container)
Packaged with a multi-stage Dockerfile and optimized `nginx:alpine` runtime on port 3000:
```bash
docker compose up -d console
```

#### Option B: Standalone Node.js & Vite
```bash
# Development with hot-reload (port 3000)
make console-dev        # or: cd console && npm install && npm run dev

# Production build & preview server
make console-build
make console-serve      # or: cd console && npm run preview
```

#### Option C: Edge Hosting (Vercel / Cloudflare Pages)
Deploy directly from `console/` using the provided blueprint (`deploy/paas/vercel.json`):
```bash
cd console && vercel --prod
```

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

1. Navigate to **New > Blueprint** in the Render console.
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
  "framework": "vite",
  "rewrites": [
    { "source": "/v1/:path*", "destination": "https://gateway-netrallm.avadhanlabs.dev/v1/:path*" },
    { "source": "/admin/:path*", "destination": "https://gateway-netrallm.avadhanlabs.dev/admin/:path*" },
    { "source": "/health", "destination": "https://gateway-netrallm.avadhanlabs.dev/health" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 3.5 Production Ingress & Custom Domain Topology (`avadhanlabs.dev`)

When deploying to production with a custom domain (e.g. registered via Name.com), map the following subdomains:

| Component | Target URL | Ingress Routing | Health Verification |
|---|---|---|---|
| **Core Gateway API** | `https://gateway-netrallm.avadhanlabs.dev` | Cloudflare Tunnel / Reverse Proxy &rarr; Port `8080` | `curl -f https://gateway-netrallm.avadhanlabs.dev/health` |
| **Operations Console** | `https://console-netrallm.avadhanlabs.dev` | Cloudflare Tunnel / Vercel &rarr; Port `3000` | Browser or `curl -I https://console-netrallm.avadhanlabs.dev` |
| **Documentation Site** | `https://docs-netrallm.avadhanlabs.dev` | GitHub Pages | `curl -I https://docs-netrallm.avadhanlabs.dev` |

**DNS Configuration (Name.com / Cloudflare Zero Trust):**
* `gateway-netrallm` (CNAME) -> Cloudflare Tunnel UUID target or VPS public IP.
* `console-netrallm` (CNAME) -> Cloudflare Tunnel target or `cname.vercel-dns.com`.
* `docs-netrallm` (CNAME) -> `shashankch.github.io.` (GitHub Pages custom domain).

### 3.6 Ops Console Connectivity & Cloud Free-Tier Safeguards

The Ops Console includes native configuration controls to communicate across origins:
- **Configurable Gateway Endpoint:** Supports both Same-Origin deployments (empty string, proxies `/v1` and `/admin`) and Custom Remote endpoints (e.g., `https://gateway-netrallm.avadhanlabs.dev`) with a 1-click "Use Default Origin" reset.
- **High-Precedence CORS Filter:** The gateway runs a dedicated `FilterRegistrationBean<CorsFilter>` bean configured at `Ordered.HIGHEST_PRECEDENCE`, intercepting preflight `OPTIONS` requests before Spring security/servlet dispatchers to permit cross-subdomain API calls.
- **Interactive Connectivity Probe:** Provides real-time gateway reachability and round-trip latency pings (`GET /health`) directly from the settings dialog.
- **Free-Tier Friendly Health Polling:** Background health monitoring uses the Page Visibility API (suspends polling when the browser tab is hidden), adaptive exponential backoff (30s baseline to 120s backoff), and an operator toggle to avoid waking sleeping or scale-to-zero compute instances.

---

## 4. Tier 3: Production Enterprise Cloud Deployment

For high-throughput, mission-critical enterprise workloads, deploy NETRA in high-availability multi-zone clusters across dedicated cloud infrastructure (**AWS**, **Microsoft Azure**, **Google Cloud Platform**, **Oracle Cloud Infrastructure**, or bare-metal server clusters).

### 4.1 Production Enterprise Reference Architecture

In high-scale enterprise environments handling millions of LLM requests daily, NETRA deploys as a horizontally scalable, stateless gateway tier decoupled from managed backing data stores:

![NETRA Enterprise Cloud Deployment Topology](diagrams/05_enterprise_deployment_dark.svg)

- **Stateless Gateway Tier:** Horizontally scaled container instances running Java 25 Virtual Threads. Gateway instances handle tens of thousands of concurrent SSE streams with near-zero CPU idle footprint and sub-0.5ms proxy overhead.
- **Managed Vector Storage:** Managed PostgreSQL 18 with `pgvector` (such as **AWS Aurora PostgreSQL**, **Azure Database for PostgreSQL Flexible Server**, or **GCP Cloud SQL**) configured with Multi-AZ failover, read replicas for vector queries, and SSD-backed HNSW indexes (`m=16, ef_construction=64`).
- **Distributed Admission Control:** High-availability managed Redis 8.0 cluster (such as **AWS ElastiCache**, **Azure Managed Redis / Azure Cache for Redis**, or **GCP Memorystore**) with multi-AZ replication, ensuring atomic sliding-window Lua execution and zero over-admission across all gateway nodes.
- **Enterprise Ingress & TLS 1.3:** TLS termination and DDoS mitigation handled by enterprise edge ingress (AWS Application Load Balancer, Azure Application Gateway / Azure Front Door, Google Cloud Armor, or Cloudflare Enterprise) forwarding authenticated traffic to internal VPC gateway endpoints.

### 4.2 Hardware & Cluster Sizing Matrix

| Deployment Tier | Concurrency & Throughput | Gateway Node Sizing | Backing Infrastructure |
|---|---|---|---|
| **Enterprise High-Scale** | 10,000+ Concurrent Virtual Threads / 25,000+ RPM | 3–10 Nodes (4 vCPU, 8 GB RAM each) | AWS Aurora PostgreSQL / Azure PostgreSQL / GCP Cloud SQL + ElastiCache / Azure Managed Redis Cluster |
| **Production Standard** | 2,000–5,000 Concurrent Virtual Threads / 5,000 RPM | 2–4 Nodes (2 vCPU, 4 GB RAM each) | Managed PostgreSQL (pgvector) + High-Availability Redis |
| **Developer / Staging** | 100–500 RPM | Single Instance (2–4 vCPUs, 4–8 GB RAM) | Docker Compose or Cloud VM |

### 4.3 Container Orchestration (Kubernetes / ECS)

Deploy gateway pods to Amazon EKS, Azure Kubernetes Service (AKS), Google GKE, or Amazon ECS using the official multi-architecture container images:

```yaml
containers:
- name: gateway
  image: ghcr.io/shashankch/netra-gateway:latest
  ports:
  - containerPort: 8080
  env:
  - name: SPRING_PROFILES_ACTIVE
    value: "prod"
  - name: JAVA_TOOL_OPTIONS
    value: "-XX:+UseZGC -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"
  resources:
    requests: { cpu: "1000m", memory: "2Gi" }
    limits:   { cpu: "4000m", memory: "4Gi" }
```

For production orchestration guides across major cloud managed Kubernetes services, refer to the official documentation:
- [Kubernetes Deployments Specification](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Horizontal Pod Autoscaling (HPA) Guide](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Amazon EKS User Guide](https://docs.aws.amazon.com/eks/)
- [Azure Kubernetes Service (AKS)](https://learn.microsoft.com/en-us/azure/aks/)
- [Google Kubernetes Engine (GKE)](https://cloud.google.com/kubernetes-engine/docs)

### 4.4 Automated Host Provisioning & Cloud VM Deployments

For single-host cloud deployments, bootstrap the host with [`setup-vps.sh`](https://github.com/shashankch/netra-llmgateway/blob/main/deploy/cloud-vps/setup-vps.sh):

- **Mode A: Direct Inbound Port Exposure (Opens port 8080)**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash
  ```

- **Mode B: Zero-Open-Port Cloudflare Tunnel (Hardened Ingress)**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash -s -- <CLOUDFLARE_TUNNEL_TOKEN>
  ```

!!! tip "Official Cloud Documentation"
    - **Oracle Cloud Infrastructure (OCI):** [OCI Getting Started Guide](https://docs.oracle.com/en-us/iaas/Content/GSG/Concepts/baremetalintro.htm) · [OCI Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
    - **Amazon Web Services (AWS):** [AWS Free Tier Guide](https://aws.amazon.com/free/)
    - **Cloudflare Zero Trust:** [Cloudflare Tunnels Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)

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

For detailed endpoint specifications and error envelopes, see the [REST API Reference](api-reference.md).
