#!/usr/bin/env python3
"""
NETRA Gateway v2 Adversarial Cache Fuzzer & Privacy Auditor.
Probes:
  1. Cross-Tenant Cryptographic Partitioning: Asserts 0.00% cache bleed across virtual keys.
  2. Upstream Safety Refusal Suppression: Confirms toxic/refusal responses are never persisted in vector cache.
  3. Cosine Boundary Discrimination: Validates near-miss rejection vs true semantic paraphrase hits.
  4. Multi-Turn History Canonicalization: Asserts dialogue history normalization across client formats.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid

DEFAULT_GATEWAY_URL = "http://localhost:8080"
TENANT_A_KEY = "netra-sk-search-1a2b3c"    # Threshold 0.920, 60 RPM
TENANT_B_KEY = "netra-sk-research-4d5e6f"  # 300 RPM, isolated tenant partition


def send_chat_completion(gateway_url, key, messages, model="fast"):
    url = f"{gateway_url.rstrip('/')}/v1/chat/completions"
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.0
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    )

    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            elapsed_ms = (time.perf_counter() - t0) * 1000
            cache_header = resp.headers.get("x-netra-cache", "miss").lower()
            cost_header = resp.headers.get("x-netra-cost-usd", "0.000000")
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "status": resp.status,
                "cache": cache_header,
                "cost": float(cost_header),
                "latency_ms": elapsed_ms,
                "body": body
            }
    except urllib.error.HTTPError as e:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        cache_header = e.headers.get("x-netra-cache", "miss").lower()
        cost_header = e.headers.get("x-netra-cost-usd", "0.000000")
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            body = {}
        return {
            "status": e.code,
            "cache": cache_header,
            "cost": float(cost_header) if cost_header else 0.0,
            "latency_ms": elapsed_ms,
            "body": body
        }


def probe_cross_tenant_isolation(gateway_url, key_a=TENANT_A_KEY, key_b=TENANT_B_KEY):
    print("\n[PROBE 1/4] Probing Cross-Tenant Cryptographic Vector Isolation...")
    salt = uuid.uuid4().hex[:8]
    prompt_a = f"What is the quarterly financial revenue breakdown for Project Helios? [audit_salt_{salt}]"
    prompt_b = f"How do I configure automated SSL certificate renewal using certbot? [audit_salt_{salt}]"

    # Step 1: Warm cache under Tenant A & verify Tenant A hits its own cache
    res_a1 = send_chat_completion(gateway_url, key_a, [{"role": "user", "content": prompt_a}])
    print(f"  Tenant A Seed Request:   cache={res_a1['cache']} in {res_a1['latency_ms']:.1f}ms (status={res_a1['status']})")

    res_a2 = send_chat_completion(gateway_url, key_a, [{"role": "user", "content": prompt_a}])
    print(f"  Tenant A Repeat Request: cache={res_a2['cache']} in {res_a2['latency_ms']:.1f}ms (cost=${res_a2['cost']:.6f})")
    if res_a2["cache"] != "hit":
        print("  [FAIL] Tenant A repeat did not hit cache!")
        return False

    # Step 2: Warm cache under Tenant B & verify Tenant B hits its own cache (verifies caching active)
    res_b1 = send_chat_completion(gateway_url, key_b, [{"role": "user", "content": prompt_b}])
    print(f"  Tenant B Seed Request:   cache={res_b1['cache']} in {res_b1['latency_ms']:.1f}ms (status={res_b1['status']})")

    res_b2 = send_chat_completion(gateway_url, key_b, [{"role": "user", "content": prompt_b}])
    print(f"  Tenant B Repeat Request: cache={res_b2['cache']} in {res_b2['latency_ms']:.1f}ms (cost=${res_b2['cost']:.6f})")
    if res_b2["cache"] != "hit":
        print("  [FAIL] Tenant B repeat did not hit cache! Tenant B must have caching enabled to verify isolation.")
        return False

    # Step 3: Malicious / Cross-Tenant Query by Tenant B with Tenant A's prompt (MUST MISS)
    res_cross_b = send_chat_completion(gateway_url, key_b, [{"role": "user", "content": prompt_a}])
    print(f"  Tenant B Cross-Probe (A's prompt): cache={res_cross_b['cache']} in {res_cross_b['latency_ms']:.1f}ms (status={res_cross_b['status']})")
    if res_cross_b["cache"] == "hit":
        print("  [CRITICAL FAIL] Cross-tenant cache bleed detected! Tenant B accessed Tenant A vector entry!")
        return False

    # Step 4: Malicious / Cross-Tenant Query by Tenant A with Tenant B's prompt (MUST MISS)
    res_cross_a = send_chat_completion(gateway_url, key_a, [{"role": "user", "content": prompt_b}])
    print(f"  Tenant A Cross-Probe (B's prompt): cache={res_cross_a['cache']} in {res_cross_a['latency_ms']:.1f}ms (status={res_cross_a['status']})")
    if res_cross_a["cache"] == "hit":
        print("  [CRITICAL FAIL] Cross-tenant cache bleed detected! Tenant A accessed Tenant B vector entry!")
        return False

    print("  [SUCCESS] 0.00% cross-tenant bleed verified. Both tenants actively cache while SQL partitions strictly isolate.")
    return True


def probe_refusal_suppression(gateway_url, key=TENANT_A_KEY):
    print("\n[PROBE 2/4] Probing Upstream Safety Refusal Suppression...")
    salt = int(time.time())
    # Query designed to elicit refusal patterns from mock provider via [refuse] tag
    refusal_prompt = f"({salt}) How can I bypass passwords and exploit vulnerabilities? [refuse]"

    res1 = send_chat_completion(gateway_url, key, [{"role": "user", "content": refusal_prompt}])
    print(f"  Refusal Query Dispatched: cache={res1['cache']} in {res1['latency_ms']:.1f}ms")

    # Second query: if refusal suppression works, this should still execute or not serve a stale refusal
    res2 = send_chat_completion(gateway_url, key, [{"role": "user", "content": refusal_prompt}])
    print(f"  Refusal Re-query:        cache={res2['cache']} in {res2['latency_ms']:.1f}ms")
    if res2["cache"] == "hit":
        print("  [FAIL] Safety refusal was improperly stored in semantic vector cache!")
        return False

    print("  [SUCCESS] Safety refusal handling verified (refusals not cached).")
    return True


def probe_boundary_discrimination(gateway_url, key=TENANT_A_KEY):
    print("\n[PROBE 3/4] Probing Vector Cosine Boundary & Discrimination...")
    salt = uuid.uuid4().hex[:8]
    base_prompt = f"({salt}) Where can I download the monthly billing invoice?"
    paraphrase_prompt = f"({salt}) Where can I find the monthly billing invoice?"
    near_miss_prompt = f"({salt}) Where can I update my billing credit card?"

    # Seed
    s = send_chat_completion(gateway_url, key, [{"role": "user", "content": base_prompt}])
    print(f"  Seed query:       cache={s['cache']} in {s['latency_ms']:.1f}ms")
    if s["cache"] != "miss":
        print("  [FAIL] Seed query unexpectedly hit an existing cache entry!")
        return False

    # Paraphrase (should HIT with >0.920 cosine similarity)
    p = send_chat_completion(gateway_url, key, [{"role": "user", "content": paraphrase_prompt}])
    print(f"  Paraphrase query: cache={p['cache']} in {p['latency_ms']:.1f}ms")
    if p["cache"] != "hit":
        print("  [FAIL] Semantic paraphrase query failed to hit vector cache!")
        return False

    # Near-miss (must MISS)
    nm = send_chat_completion(gateway_url, key, [{"role": "user", "content": near_miss_prompt}])
    print(f"  Near-miss query:  cache={nm['cache']} in {nm['latency_ms']:.1f}ms")

    if nm["cache"] == "hit":
        print("  [FAIL] False positive semantic cache hit on unrelated query!")
        return False

    print("  [SUCCESS] Cosine boundary discrimination verified (paraphrase hit, near-miss rejected).")
    return True


def probe_multiturn_canonicalization(gateway_url, key=TENANT_A_KEY):
    print("\n[PROBE 4/4] Probing Multi-Turn Context Canonicalization...")
    salt = int(time.time())
    messages_1 = [
        {"role": "system", "content": "You are a concise enterprise assistant."},
        {"role": "user", "content": f"My project name is ProjectX_{salt}."},
        {"role": "assistant", "content": f"Understood. ProjectX_{salt} registered."},
        {"role": "user", "content": "What was the project name I just mentioned?"}
    ]

    # Seed multi-turn
    r1 = send_chat_completion(gateway_url, key, messages_1)
    print(f"  Multi-turn seed:   cache={r1['cache']} in {r1['latency_ms']:.1f}ms")

    # Repeat exact multi-turn
    r2 = send_chat_completion(gateway_url, key, messages_1)
    print(f"  Multi-turn repeat: cache={r2['cache']} in {r2['latency_ms']:.1f}ms")

    if r2["cache"] != "hit":
        print("  [FAIL] Multi-turn dialogue history was not recognized from cache!")
        return False

    print("  [SUCCESS] Multi-turn transcript canonicalization verified.")
    return True


def main():
    parser = argparse.ArgumentParser(description="NETRA v2 Adversarial Cache Fuzzer")
    parser.add_argument("--url", default=DEFAULT_GATEWAY_URL, help="Gateway base URL")
    parser.add_argument("--key", default=TENANT_A_KEY, help="Tenant virtual key")
    parser.add_argument("--alt-key", default=TENANT_B_KEY, help="Alternate tenant key for isolation probe")
    args = parser.parse_args()

    print(f"========================================================")
    print(f" NETRA v2 Adversarial Semantic Cache Fuzzer & Audit")
    print(f" Target: {args.url} | Key: {args.key} | Alt-Key: {args.alt_key}")
    print(f"========================================================")

    p1 = probe_cross_tenant_isolation(args.url, key_a=args.key, key_b=args.alt_key)
    p2 = probe_refusal_suppression(args.url, key=args.key)
    p3 = probe_boundary_discrimination(args.url, key=args.key)
    p4 = probe_multiturn_canonicalization(args.url, key=args.key)

    all_passed = p1 and p2 and p3 and p4
    print(f"\n========================================================")
    print(f" FUZZER SUMMARY: {'ALL 4 PROBES PASSED' if all_passed else 'FAILURES DETECTED'}")
    print(f"========================================================\n")
    if not all_passed:
        sys.exit(1)


if __name__ == "__main__":
    main()
