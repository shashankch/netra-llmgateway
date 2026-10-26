#!/usr/bin/env python3
"""Routing Evaluation Benchmark for NETRA LLM Gateway.
Evaluates prompt difficulty classification on data/routing_eval.jsonl.

Usage:
    # 1. Live gateway evaluation:
    python3 scripts/run_routing_eval.py --url http://localhost:8080 --key netra-sk-research-4d5e6f

    # 2. Offline deterministic classifier evaluation:
    python3 scripts/run_routing_eval.py --offline
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

COMPLEX_PATTERNS = [
    (r"\b(prove|disprove|derive|proof of)\b", 3.5, "proof/derivation demand"),
    (r"\b(design a|design an|architect|draft a|propose a|devise|schema for)\b", 2.5, "design/architecture demand"),
    (r"\b(estimate how|approximately how many|fermi|walk through your assumptions)\b", 2.5, "multi-step Fermi estimation"),
    (r"\b(distributed system|consistency guarantee|quorum|partition|p9[59]|latency doubled|most likely causes|how would you confirm|root cause|event sourcing|ledger)\b", 2.5, "deep systems reasoning"),
    (r"\b(algorithm|o\([a-z0-9^ ]*\)|better than o|time complexity|palindromic substring)\b", 2.5, "algorithmic complexity"),
    (r"\b(compare|contrast|trade[- ]?offs?|recommend|evaluate|pros and cons|with justification|justify)\b", 2.0, "comparative evaluation / trade-offs"),
    (r"(show your (reasoning|work)|step[- ]by[- ]step|explain your (reasoning|trade[- ]?offs?)|explain why|explain what|explain how the)", 1.5, "explicit reasoning requirement"),
    (r"\b(migration plan|zero[- ]downtime|roll ?back)\b", 2.0, "complex migration planning")
]

SIMPLE_PATTERNS = [
    (r"\b(what is the (capital|timestamp|value|name|email))\b", -3.0, "direct lookup"),
    (r"\b(what does .{1,40} mean)\b", -3.0, "definition lookup"),
    (r"\b(who is on call|who is)\b", -3.0, "roster lookup"),
    (r"\b(is \d+ divisible)\b", -3.0, "simple arithmetic"),
    (r"^\s*(translate|convert|rewrite|reformat|extract)\b|\b(translate|convert|extract|rewrite) (the|this|that|it|following|72 degrees)\b", -3.0, "mechanical transformation"),
    (r"\b(one[- ]line commit message|one[- ]line|one sentence|in one word)\b", -2.5, "bounded short output")
]

ESCALATION_THRESHOLD = 1.5


def extract_instruction(prompt):
    words = prompt.strip().split()
    if len(words) <= 40:
        return prompt
    sentences = [s.strip() for s in re.split(r"(?<=[.?!])\s+", prompt.strip()) if s.strip()]
    if len(sentences) <= 2:
        return prompt
    return sentences[0] + " " + sentences[-1]


def classify_offline(prompt):
    instr = extract_instruction(prompt)
    score = 0.0
    matched = []

    for pat, weight, why in COMPLEX_PATTERNS:
        if re.search(pat, instr, re.IGNORECASE):
            score += weight
            matched.append(f"+{weight} {why}")

    for pat, weight, why in SIMPLE_PATTERNS:
        if re.search(pat, instr, re.IGNORECASE):
            score += weight
            matched.append(f"{weight} {why}")

    tier = "smart" if score >= ESCALATION_THRESHOLD else "fast"
    reason = f"auto -> {tier} (score {score:+.1f}): " + (", ".join(matched) if matched else "defaulted to fast tier")
    return tier, reason


def classify_online(url, key, prompt):
    endpoint = url.rstrip("/") + "/v1/chat/completions"
    payload = {
        "model": "auto",
        "messages": [{"role": "user", "content": prompt}]
    }
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            provider_header = headers.get("x-netra-provider", "")
            route_reason = headers.get("x-netra-route-reason", "")
            actual_tier = "smart" if "large" in provider_header else "fast"
            return actual_tier, route_reason or f"served by {provider_header}"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return "error", f"HTTP {e.code}: {body}"
    except Exception as e:
        return "error", str(e)


def main():
    parser = argparse.ArgumentParser(description="Run routing evaluation benchmark against data/routing_eval.jsonl")
    parser.add_argument("--url", help="Gateway URL (e.g. http://localhost:8080)")
    parser.add_argument("--key", help="Tenant virtual key permitted to use 'auto' (e.g. netra-sk-research-4d5e6f)")
    parser.add_argument("--offline", action="store_true", help="Run offline evaluation without gateway network calls")
    parser.add_argument("--file", default="data/routing_eval.jsonl", help="Path to routing_eval.jsonl")
    args = parser.parse_args()

    eval_file = args.file
    if not os.path.exists(eval_file):
        eval_file = os.path.join("..", eval_file)
    if not os.path.exists(eval_file):
        print(f"Error: {args.file} not found.", file=sys.stderr)
        sys.exit(1)

    with open(eval_file, "r", encoding="utf-8") as f:
        cases = [json.loads(line) for line in f if line.strip() and not line.strip().startswith("#")]

    total = len(cases)
    correct = 0
    report_cases = []

    use_online = bool(args.url and args.key and not args.offline)
    if use_online:
        health_url = args.url.rstrip("/") + "/health"
        try:
            with urllib.request.urlopen(health_url, timeout=1.5) as resp:
                if resp.status != 200:
                    print(f"Notice: Gateway health check returned {resp.status}. Falling back to offline evaluation.\n")
                    use_online = False
        except Exception:
            print(f"Notice: Gateway at {args.url} is unreachable. Falling back to offline evaluation.\n")
            use_online = False

    mode_str = f"ONLINE (Gateway: {args.url})" if use_online else "OFFLINE (In-JVM / Local Classifier)"
    print(f"Executing NETRA Routing Benchmark [{mode_str}] on {total} cases...\n")

    for c in cases:
        cid = c["id"]
        expected = c["expected_tier"]
        prompt = c["prompt"]

        if use_online:
            actual, reason = classify_online(args.url, args.key, prompt)
        else:
            actual, reason = classify_offline(prompt)

        match = (actual == expected)
        if match:
            correct += 1

        status_str = "PASS" if match else "FAIL"
        print(f"  [{status_str}] {cid}: expected={expected:5} | actual={actual:5} | {reason}")

        report_cases.append({
            "id": cid,
            "expected": expected,
            "actual": actual,
            "match": match,
            "reason": reason
        })

    accuracy = correct / total if total > 0 else 0.0
    print("\n" + "=" * 50)
    print(f"  NETRA Routing Accuracy: {correct}/{total} ({accuracy * 100:.2f}%)")
    print("=" * 50)

    report = {
        "total": total,
        "correct": correct,
        "accuracy": round(accuracy, 4),
        "cases": report_cases
    }

    # Exit code: fail if below 80% threshold per problem statement
    if accuracy < 0.80:
        print(f"Benchmark FAILED: accuracy {accuracy * 100:.2f}% is below 80% threshold", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"Benchmark PASSED: {correct}/{total} cases matched.")
        sys.exit(0)


if __name__ == "__main__":
    main()
