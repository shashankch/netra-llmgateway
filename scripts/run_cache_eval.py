#!/usr/bin/env python3
"""Semantic Vector Cache Evaluation Benchmark for NETRA LLM Gateway.
Evaluates in-JVM dense embedding generation, pgvector HNSW nearest-neighbor retrieval,
tenant isolation, paraphrase matching, near-miss rejection, and $0 cost accounting.

Usage:
    python3 scripts/run_cache_eval.py --url http://localhost:8080 --key netra-sk-search-1a2b3c
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid

RESULTS = []


def record(name, passed, detail=""):
    RESULTS.append((name, passed, detail))
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}] {name}" + (f": {detail}" if detail else ""))


def post_chat(base_url, api_key, payload):
    url = f"{base_url.rstrip('/')}/v1/chat/completions"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            elapsed_ms = (time.time() - t0) * 1000.0
            body = json.loads(resp.read().decode("utf-8"))
            return resp.status, dict(resp.headers), body, elapsed_ms
    except urllib.error.HTTPError as e:
        elapsed_ms = (time.time() - t0) * 1000.0
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            body = {}
        return e.code, dict(e.headers), body, elapsed_ms


def get_stats(base_url, admin_key="netra-admin-demo"):
    url = f"{base_url.rstrip('/')}/admin/cache/stats"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {admin_key}"},
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, {}


def main():
    parser = argparse.ArgumentParser(description="NETRA Semantic Cache Benchmark")
    parser.add_argument("--url", default="http://localhost:8080", help="Gateway URL")
    parser.add_argument("--key", default="netra-sk-search-1a2b3c", help="Valid tenant key with semantic cache enabled")
    parser.add_argument("--alt-key", default="netra-sk-free-7g8h9i", help="Alternate tenant key for isolation test")
    parser.add_argument("--admin-key", default="netra-admin-demo", help="Admin key")
    args = parser.parse_args()

    salt = uuid.uuid4().hex[:8]
    print(f"\n==================================================")
    print(f"NETRA Semantic Vector Cache Benchmark (Salt: {salt})")
    print(f"==================================================")

    # 1. First request -> Miss
    print("\n[1] Cold Cache Miss")
    p1 = f"({salt}) How do I cancel my subscription on the console?"
    body1 = {"model": "fast", "messages": [{"role": "user", "content": p1}]}
    status, headers, resp, lat1 = post_chat(args.url, args.key, body1)
    record("Cold request returns 200", status == 200, f"got {status}")
    record("Cold request is a cache miss", headers.get("x-netra-cache") == "miss", headers.get("x-netra-cache"))
    record("Cost header reflects computed spend", float(headers.get("x-netra-cost-usd", "0")) > 0, headers.get("x-netra-cost-usd"))

    # 2. Exact Repeat -> Hit
    print("\n[2] Exact Repeat Cache Hit")
    status, headers, resp, lat2 = post_chat(args.url, args.key, body1)
    record("Exact repeat returns 200", status == 200, f"got {status}")
    record("Exact repeat is a cache hit", headers.get("x-netra-cache") == "hit", headers.get("x-netra-cache"))
    record("Cost is $0.000000 on cache hit", headers.get("x-netra-cost-usd") == "0.000000", headers.get("x-netra-cost-usd"))
    record("Route reason is semantic_cache_hit", headers.get("x-netra-route-reason") == "semantic_cache_hit", headers.get("x-netra-route-reason"))
    record("Cache hit has low latency (< 100ms)", lat2 < 100.0, f"{lat2:.1f}ms")

    # 3. Paraphrase Match -> Hit
    print("\n[3] Semantic Paraphrase Hit")
    p_para = f"({salt}) What are the steps to cancel my console subscription?"
    body_para = {"model": "fast", "messages": [{"role": "user", "content": p_para}]}
    status, headers, resp, lat3 = post_chat(args.url, args.key, body_para)
    record("Paraphrase returns 200", status == 200, f"got {status}")
    record("Paraphrase is a cache hit", headers.get("x-netra-cache") == "hit", headers.get("x-netra-cache"))
    record("Paraphrase cost is $0.000000", headers.get("x-netra-cost-usd") == "0.000000", headers.get("x-netra-cost-usd"))

    # 4. Near-Miss Rejection -> Miss
    print("\n[4] Near-Miss Rejection")
    p_near = f"({salt}) How do I upgrade my subscription on the console?"
    body_near = {"model": "fast", "messages": [{"role": "user", "content": p_near}]}
    status, headers, resp, _ = post_chat(args.url, args.key, body_near)
    record("Near-miss returns 200", status == 200, f"got {status}")
    record("Near-miss is a cache miss", headers.get("x-netra-cache") == "miss", headers.get("x-netra-cache"))

    # 5. Cross-Tenant Cryptographic Isolation
    print("\n[5] Cross-Tenant Cryptographic Partitioning")
    status, headers, resp, _ = post_chat(args.url, args.alt_key, body1)
    record("Alternate tenant query returns 200", status == 200, f"got {status}")
    record("Alternate tenant cannot access key A cache (Cache Miss)", headers.get("x-netra-cache") == "miss", headers.get("x-netra-cache"))

    # 6. Admin Cache Stats Endpoint
    print("\n[6] Admin Cache Statistics API")
    status, stats = get_stats(args.url, args.admin_key)
    record("Admin cache stats returns 200", status == 200, f"got {status}")
    record("Total entries > 0", stats.get("total_entries", 0) > 0, f"entries={stats.get('total_entries')}")
    record("Total hits > 0", stats.get("total_hits", 0) > 0, f"hits={stats.get('total_hits')}")
    record("Hit rate computed", 0 <= stats.get("hit_rate", -1) <= 1, f"hit_rate={stats.get('hit_rate')}")
    record("Per-key stats present", args.key in stats.get("keys", {}), f"keys count={len(stats.get('keys', {}))}")

    failed = [r for r in RESULTS if not r[1]]
    print("\n==================================================")
    print(f"Results: {len(RESULTS) - len(failed)} passed, {len(failed)} failed")
    print("==================================================")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
