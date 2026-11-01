#!/usr/bin/env bash
# ==============================================================================
# NETRA LLM Gateway — Unified Zero-Cost Cloud VM Setup Script
#
# Compatible with:
#   1. Oracle Cloud Infrastructure (OCI) Always Free (4 ARM vCPUs, 24GB RAM)
#   2. AWS Free Tier (EC2 t4g.small / t3.micro Ubuntu 24.04 LTS)
#
# USAGE:
#   # Mode A: Standard Direct Exposure (opens port 8080)
#   curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash
#
#   # Mode B: Production Zero-Open-Port Cloudflare Tunnel (100% Free, Zero Open Ports)
#   curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash -s -- <CLOUDFLARE_TUNNEL_TOKEN>
# ==============================================================================

set -euo pipefail

TUNNEL_TOKEN="${1:-${CLOUDFLARE_TUNNEL_TOKEN:-}}"

echo "=========================================================="
echo "⚡ Starting NETRA Production Cloud Host Provisioning..."
if [ -n "$TUNNEL_TOKEN" ]; then
    echo "🔒 Ingress Mode: Zero-Open-Port Cloudflare Tunnel (Docker)"
else
    echo "🌐 Ingress Mode: Direct Inbound Port (8080)"
fi
echo "=========================================================="

# 1. Update system packages
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    make \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw

# 2. Install Docker Engine and Docker Compose Plugin
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER"
    echo "Docker installed successfully."
fi

# 3. Configure Host Firewall (UFW)
echo "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH

if [ -z "$TUNNEL_TOKEN" ]; then
    # Direct exposure mode: open web and gateway ports
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 8080/tcp  # NETRA Gateway
else
    # Zero-Open-Port mode: ensure all inbound web ports are blocked
    sudo ufw delete allow 80/tcp 2>/dev/null || true
    sudo ufw delete allow 443/tcp 2>/dev/null || true
    sudo ufw delete allow 8080/tcp 2>/dev/null || true
fi
sudo ufw --force enable

# 4. Clone NETRA Repository if not present
if [ ! -d "netra-llmgateway" ]; then
    echo "Cloning NETRA repository..."
    git clone https://github.com/shashankch/netra-llmgateway.git
    cd netra-llmgateway
else
    cd netra-llmgateway
    git pull origin main
fi

# Ensure .env file exists
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
fi

# 5. Launch Stack via Containerized Docker Compose
echo "Booting NETRA services via Docker Compose..."

if [ -n "$TUNNEL_TOKEN" ]; then
    # Inject tunnel token into .env if not already present
    if grep -q "CLOUDFLARE_TUNNEL_TOKEN" .env; then
        sed -i.bak "s|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}|" .env
    else
        echo "CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}" >> .env
    fi

    # Boot stack with containerized cloudflared profile
    docker compose --profile tunnel up -d --build
    echo "=========================================================="
    echo "✅ NETRA Gateway & Containerized Cloudflare Tunnel are LIVE!"
    echo "🔒 Zero Inbound Open Ports: Port 8080 is blocked from the internet."
    echo "🌐 Cloudflare is proxying traffic securely to http://gateway:8080"
    echo "Verify local container health: curl -f http://localhost:8080/health"
    echo "Check tunnel logs: docker compose logs -f cloudflared"
    echo "=========================================================="
else
    # Standard boot
    docker compose up -d --build
    echo "=========================================================="
    echo "✅ NETRA Gateway provisioned and running!"
    echo "Verify status: curl -f http://localhost:8080/health"
    echo "----------------------------------------------------------"
    echo "💡 Optional Zero-Cost Upgrade: Zero-Open-Port Cloudflare Tunnel"
    echo "Run cloudflared natively in Docker with zero host installs:"
    echo "  CLOUDFLARE_TUNNEL_TOKEN=\"<TOKEN>\" docker compose --profile tunnel up -d"
    echo "=========================================================="
fi
