# Security Policy

NETRA is an open-source project licensed under [Apache 2.0](https://github.com/shashankch/netra-llmgateway/blob/main/LICENSE).

---

## Active Development & Cloud Testbeds

- **Status:** NETRA is in active development. Fixes are applied directly to `main`.
- **Hosted Evaluation & Demo Sandboxes:** Hosted instances on **OCI**, **AWS**, and managed **PaaS** (e.g., Render, Railway) operate strictly as **pre-production demonstration testbeds and evaluation sandboxes** (providing rate-limited, live upstream LLM inference for prompt evaluation). They are ephemeral, demonstration-purpose environments and are not intended for proprietary or regulated business workloads. **Do not transmit production upstream provider keys, confidential intellectual property, or sensitive PII.**
- **Testing Rules:** Validate exploits locally (`make dev` / `docker compose up`). Do not run volumetric DoS/DDoS attacks, resource exhaustion scripts, or brute-force floods against hosted OCI, AWS, or PaaS infrastructure.

---

## Reporting a Vulnerability

If you discover a security vulnerability (such as an auth bypass, cross-tenant data leak, or secret exposure):

1. **GitHub Security Advisories (Recommended):** Submit a private vulnerability report directly via [GitHub Private Vulnerability Reporting](https://github.com/shashankchandel/netra-llmgateway/security/advisories/new). This enables confidential, encrypted tracking, collaborative remediation, and coordinated disclosure.
2. **Email (Alternative):** Report privately to **shashankchandel@gmail.com** with the subject `[NETRA Security] <Brief Summary>`.
3. **Details:** Include minimal reproduction steps, `curl` request / PoC, and the affected component.
4. **Timeline:** Reports are acknowledged within **48 hours**. Please allow coordinated disclosure before public release.
