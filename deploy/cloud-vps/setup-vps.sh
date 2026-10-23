#!/usr/bin/env bash
# ==============================================================================
# NETRA LLM Gateway — Unified Zero-Cost Cloud VM Setup Script
# Compatible with:
#   1. Oracle Cloud Infrastructure (OCI) Always Free (4 ARM vCPUs, 24GB RAM)
#   2. AWS Free Tier (EC2 t4g.small / t3.micro Ubuntu 24.04 LTS)
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "⚡ Starting NETRA Production Cloud Host Provisioning..."
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

# 3. Configure Firewall (UFW)
echo "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8080/tcp  # NETRA Gateway
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

# 5. Launch Stack via Docker Compose
echo "Booting NETRA services..."
docker compose up -d --build

echo "=========================================================="
echo "✅ NETRA Gateway provisioned and running!"
echo "Verify status: curl -f http://localhost:8080/health"
echo "=========================================================="
