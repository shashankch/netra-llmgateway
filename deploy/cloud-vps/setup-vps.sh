#!/usr/bin/env bash
# ==============================================================================
# NETRA LLM Gateway — Unified Zero-Cost Cloud VM Setup Script (2026 Edition)
#
# Officially Verified & Compatible with:
#   1. Oracle Cloud Infrastructure (OCI) Always Free
#      - Shape: VM.Standard.A1.Flex (Up to 4 ARM64 OCPUs, 24GB RAM, 200GB NVMe)
#      - OS: Canonical Ubuntu 24.04 LTS (Noble Numbat) / Ubuntu 22.04 LTS (aarch64)
#   2. AWS Free Tier & Graviton Trial
#      - Shape: EC2 t4g.small (Free trial through 2026) / t4g.micro / t3.micro
#      - OS: Ubuntu 24.04 LTS (Noble Numbat)
#
# USAGE:
#   # Mode A: Standard Direct Exposure (opens port 8080 with OCI iptables unblock)
#   curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash
#
#   # Mode B: Production Zero-Open-Port Cloudflare Tunnel (100% Free, Zero Open Inbound Ports)
#   curl -fsSL https://raw.githubusercontent.com/shashankch/netra-llmgateway/main/deploy/cloud-vps/setup-vps.sh | bash -s -- <CLOUDFLARE_TUNNEL_TOKEN>
# ==============================================================================

set -euo pipefail

TUNNEL_TOKEN="${1:-${CLOUDFLARE_TUNNEL_TOKEN:-}}"

echo "=========================================================="
echo "⚡ Starting NETRA Production Cloud Host Provisioning (2026)..."
if [ -n "$TUNNEL_TOKEN" ]; then
    echo "🔒 Ingress Mode: Zero-Open-Port Cloudflare Tunnel (Docker)"
else
    echo "🌐 Ingress Mode: Direct Inbound Port (8080)"
fi
echo "=========================================================="

# 1. Update system packages
export DEBIAN_FRONTEND=noninteractive
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
    ufw \
    iptables

# 2. Kernel Tuning for High-Concurrency SSE Streams (Java 25 Virtual Threads)
echo "Optimizing kernel sysctl parameters for high-concurrency streaming..."
sudo tee /etc/sysctl.d/99-netra.conf > /dev/null << 'EOF'
net.core.somaxconn = 65535
fs.file-max = 2097152
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_tw_reuse = 1
EOF
sudo sysctl --system > /dev/null 2>&1 || true

# 3. Install Docker Engine and Docker Compose Plugin (Official 2026 Apt Keyring Standard)
if ! command -v docker &> /dev/null; then
    echo "Installing Docker Engine and Compose plugin..."
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER"
    echo "Docker installed successfully."
fi

# 4. Configure Host Firewall (UFW & Oracle Cloud iptables Integration)
echo "Configuring host firewalls..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH

if [ -z "$TUNNEL_TOKEN" ]; then
    # Direct exposure mode: open web, console, and gateway ports in UFW
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 3000/tcp  # NETRA Ops Console
    sudo ufw allow 8080/tcp  # NETRA Gateway

    # Oracle Cloud Infrastructure (OCI) Ubuntu Fix:
    # OCI Ubuntu images include a default REJECT rule at the end of the INPUT chain in iptables.
    # If present, insert ACCEPT rules above the REJECT rule so traffic is not dropped before UFW.
    if sudo iptables -L INPUT -n --line-numbers 2>/dev/null | grep -q "REJECT"; then
        echo "Detected OCI iptables REJECT filter; inserting direct ingress rules..."
        REJECT_LINE=$(sudo iptables -L INPUT -n --line-numbers | grep "REJECT" | awk '{print $1}' | head -n 1)
        if [ -n "$REJECT_LINE" ] && [ "$REJECT_LINE" -gt 1 ]; then
            sudo iptables -I INPUT "$REJECT_LINE" -p tcp -m state --state NEW -m multiport --dports 80,443,3000,8080 -j ACCEPT
            if command -v netfilter-persistent &> /dev/null; then
                sudo netfilter-persistent save 2>/dev/null || true
            elif [ -f /etc/iptables/rules.v4 ]; then
                sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null 2>&1 || true
            fi
        fi
    fi
else
    # Zero-Open-Port mode: ensure all inbound web ports are blocked
    sudo ufw delete allow 80/tcp 2>/dev/null || true
    sudo ufw delete allow 443/tcp 2>/dev/null || true
    sudo ufw delete allow 8080/tcp 2>/dev/null || true
fi
sudo ufw --force enable

# 5. Clone NETRA Repository if not present
if [ ! -d "netra-llmgateway" ]; then
    echo "Cloning NETRA repository..."
    git clone https://github.com/shashankch/netra-llmgateway.git
    cd netra-llmgateway
else
    cd netra-llmgateway
    git pull origin main
fi

# Ensure .env file exists and configure hardened production profile
# Optional: Pull secrets from OCI Vault using Instance Principals if OCI_ENV_SECRET_OCID is set
if [ -n "${OCI_ENV_SECRET_OCID:-}" ]; then
    echo "🔐 Pulling production secrets from OCI Vault via Instance Principal..."
    if command -v oci &> /dev/null; then
        SECRET_BUNDLE=$(oci secrets secret-bundle get --secret-id "$OCI_ENV_SECRET_OCID" --auth instance_principal --query "data.\"secret-bundle-content\".content" --raw-output 2>/dev/null || true)
        if [ -n "$SECRET_BUNDLE" ]; then
            echo "$SECRET_BUNDLE" | base64 -d > .env
            chmod 600 .env
            echo "✅ Successfully populated .env from OCI Vault (100% Always Free)."
        fi
    fi
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    # Explicitly enforce production Spring profile on cloud VM deployment (Issue 4)
    sed -i.bak "s|^SPRING_PROFILES_ACTIVE=.*|SPRING_PROFILES_ACTIVE=prod|" .env && rm -f .env.bak
    # Auto-generate secure random admin token if demo token was present (Issue 9)
    if grep -q "NETRA_ADMIN_TOKEN=netra-admin-demo" .env; then
        RANDOM_ADMIN_TOKEN="netra-adm-$(openssl rand -hex 24 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-')"
        sed -i.bak "s|^NETRA_ADMIN_TOKEN=.*|NETRA_ADMIN_TOKEN=${RANDOM_ADMIN_TOKEN}|" .env && rm -f .env.bak
        echo "🔑 Generated random production NETRA_ADMIN_TOKEN in .env"
    fi
fi
chmod 600 .env 2>/dev/null || true

# 6. Launch Stack via Containerized Docker Compose
echo "Booting NETRA services via Docker Compose..."

if [ -n "$TUNNEL_TOKEN" ]; then
    # Inject tunnel token into .env if not already present
    if grep -q "CLOUDFLARE_TUNNEL_TOKEN" .env; then
        sed -i.bak "s|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}|" .env && rm -f .env.bak
    else
        echo "CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}" >> .env
    fi

    # Zero-Open-Port Tunnel mode: bind all published ports strictly to localhost loopback (127.0.0.1)
    # This prevents Docker iptables chains from exposing container ports to public interfaces bypassing UFW
    if grep -q "NETRA_BIND_IP" .env; then
        sed -i.bak "s|^NETRA_BIND_IP=.*|NETRA_BIND_IP=127.0.0.1|" .env && rm -f .env.bak
    else
        echo "NETRA_BIND_IP=127.0.0.1" >> .env
    fi

    # Boot stack with containerized cloudflared profile
    docker compose --profile tunnel up -d --build
    echo "=========================================================="
    echo "✅ NETRA Gateway & Containerized Cloudflare Tunnel are LIVE!"
    echo "🔒 Zero Inbound Open Ports: Port 8080 is blocked from the internet."
    echo "🌐 Ingress Hostnames (avadhanlabs.dev):"
    echo "   - API Gateway: https://gateway.netrallm.avadhanlabs.dev -> http://gateway:8080"
    echo "   - Ops Console: https://console.netrallm.avadhanlabs.dev -> http://console:3000"
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
