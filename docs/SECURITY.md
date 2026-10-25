# Security Policy

NETRA is an open-source project licensed under [Apache 2.0](https://github.com/shashankch/netra-llmgateway/blob/main/LICENSE).

---

## Active Development & Cloud Testbeds

- **Status:** NETRA is in active pre-production development (`v0.3.x`). Fixes are applied directly to `main`.
- **Cloud Dev/Test Sandboxes:** Hosted instances on **OCI** and **AWS** operate strictly as **experimental development, testing, and benchmarking sandboxes** using synthetic mock data. Do not transmit real production credentials or sensitive PII.
- **Testing Rules:** Validate exploits locally (`make dev` / `docker compose up`). Do not run volumetric DoS/DDoS attacks, resource exhaustion scripts, or brute-force floods against hosted OCI or AWS infrastructure.

---

## Reporting a Vulnerability

If you discover a security vulnerability (such as an auth bypass, cross-tenant data leak, or secret exposure):

1. **Email:** Report privately to **shashakchandel@gmail.com** with the subject `[NETRA Security] <Brief Summary>`.
2. **Details:** Include minimal reproduction steps, `curl` request / PoC, and the affected component.
3. **Timeline:** Reports are acknowledged within **48 hours**. Please allow coordinated disclosure before public release.
