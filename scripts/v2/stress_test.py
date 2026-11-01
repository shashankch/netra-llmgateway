#!/usr/bin/env python3
"""
NETRA Gateway v2 Advanced Stress & Throughput Benchmark.
Simulates high-concurrency enterprise workloads measuring:
  - TTFT (Time-to-First-Token) on streaming completions
  - Aggregate TPS (Tokens per Second) throughput
  - Latency percentiles (p50, p90, p95, p99) under sustained concurrency
  - Rate-limiting (RPM/TPM) and Budget exhaustion enforcement
"""

import argparse
import concurrent.futures
import json
import statistics
import sys
import time
import urllib.error
import urllib.request

DEFAULT_GATEWAY_URL = "http://localhost:8080"
DEFAULT_VIRTUAL_KEY = "netra-sk-search-1a2b3c"


def run_single_request(gateway_url, key, model, prompt, stream):
    url = f"{gateway_url.rstrip('/')}/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": stream,
        "temperature": 0.7
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
    )

    t0 = time.perf_counter()
    ttft = None
    tokens_received = 0
    status_code = 0
    error_msg = None

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status_code = resp.status
            if stream:
                first_chunk = True
                for line in resp:
                    if line.startswith(b"data: ") and not line.startswith(b"data: [DONE]"):
                        if first_chunk:
                            ttft = (time.perf_counter() - t0) * 1000
                            first_chunk = False
                        tokens_received += 1
            else:
                body = json.loads(resp.read().decode("utf-8"))
                usage = body.get("usage", {})
                tokens_received = usage.get("total_tokens", 10)
    except urllib.error.HTTPError as e:
        status_code = e.code
        error_msg = e.reason
    except Exception as e:
        status_code = 500
        error_msg = str(e)

    total_time_ms = (time.perf_counter() - t0) * 1000
    if ttft is None:
        ttft = total_time_ms

    return {
        "status_code": status_code,
        "total_time_ms": total_time_ms,
        "ttft_ms": ttft,
        "tokens": tokens_received,
        "error": error_msg
    }


def main():
    parser = argparse.ArgumentParser(description="NETRA v2 Enterprise Stress Benchmark")
    parser.add_argument("--url", default=DEFAULT_GATEWAY_URL, help="Gateway base URL")
    parser.add_argument("--key", default=DEFAULT_VIRTUAL_KEY, help="Tenant virtual key")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent client threads")
    parser.add_argument("--requests", type=int, default=50, help="Total requests to dispatch")
    parser.add_argument("--model", default="fast", help="Model alias or ID")
    parser.add_argument("--stream", action="store_true", help="Enable SSE streaming mode")
    args = parser.parse_args()

    print(f"\n========================================================")
    print(f" NETRA v2 Stress Benchmark: {args.requests} requests @ {args.concurrency} concurrent workers")
    print(f" Target: {args.url} | Model: {args.model} | Stream: {args.stream}")
    print(f"========================================================\n")

    prompt = "Explain why zero-downtime distributed LLM gateways require lock-free sliding window rate limiting."
    results = []

    start_benchmark = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(run_single_request, args.url, args.key, args.model, f"{prompt} [salt={i}]", args.stream)
            for i in range(args.requests)
        ]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())
    total_elapsed = time.perf_counter() - start_benchmark

    # Metric compilation
    successes = [r for r in results if r["status_code"] == 200]
    rate_limits = [r for r in results if r["status_code"] == 429]
    errors = [r for r in results if r["status_code"] not in (200, 429)]

    latencies = sorted([r["total_time_ms"] for r in successes]) if successes else [0]
    ttfts = sorted([r["ttft_ms"] for r in successes]) if successes else [0]
    total_tokens = sum(r["tokens"] for r in successes)

    p50 = statistics.median(latencies) if latencies else 0
    p90 = latencies[int(len(latencies) * 0.9)] if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0

    p50_ttft = statistics.median(ttfts) if ttfts else 0
    p99_ttft = ttfts[int(len(ttfts) * 0.99)] if ttfts else 0

    rps = len(results) / total_elapsed if total_elapsed > 0 else 0
    tps = total_tokens / total_elapsed if total_elapsed > 0 else 0

    print("--- BENCHMARK RESULTS ---")
    print(f"Total Completed Requests: {len(results)} in {total_elapsed:.2f}s")
    print(f"  HTTP 200 OK:          {len(successes)} ({len(successes)/len(results)*100:.1f}%)")
    print(f"  HTTP 429 Rate Limit:  {len(rate_limits)} ({len(rate_limits)/len(results)*100:.1f}%)")
    print(f"  HTTP 5xx/Other Errors:{len(errors)}")
    print(f"Throughput:")
    print(f"  Aggregate RPS:        {rps:.2f} req/s")
    print(f"  Aggregate TPS:        {tps:.2f} tokens/s")
    print(f"End-to-End Latency:")
    print(f"  p50 (Median):         {p50:.2f} ms")
    print(f"  p90:                  {p90:.2f} ms")
    print(f"  p95:                  {p95:.2f} ms")
    print(f"  p99:                  {p99:.2f} ms")
    if args.stream:
        print(f"Time to First Token (TTFT):")
        print(f"  p50 TTFT:             {p50_ttft:.2f} ms")
        print(f"  p99 TTFT:             {p99_ttft:.2f} ms")
    print("-------------------------\n")


if __name__ == "__main__":
    main()
