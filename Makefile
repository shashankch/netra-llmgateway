# NETRA LLM Gateway - Developer Automation Makefile

.PHONY: all help dev up down restart logs ps smoke routing-eval cache-eval load chaos cache-fuzz stress verify-all test build clean docs-serve docs-build console-dev console-build

help:
	@echo "NETRA Developer CLI Commands:"
	@echo "  make dev         - Launch backing services in Docker and run gateway locally"
	@echo "  make up          - Build and start full containerized stack (gateway + backing + console)"
	@echo "  make down        - Tear down all containers, networks, and persistent volumes"
	@echo "  make ps          - View status of all running services"
	@echo "  make logs        - Tail live container logs across all services"
	@echo "  make test        - Execute test suite via Gradle (Java 25)"
	@echo "  make smoke       - Run automated smoke test suite against running gateway"
	@echo "  make routing-eval - Run benchmark prompt difficulty routing eval"
	@echo "  make cache-eval  - Run semantic vector cache hit and isolation eval"
	@echo "  make load        - Run burst concurrency load test"
	@echo "  make chaos       - Run v2 fault injection & socket abort drill"
	@echo "  make cache-fuzz  - Run v2 adversarial vector cache fuzzer"
	@echo "  make stress      - Run v2 high-concurrency throughput test"
	@echo "  make verify-all  - Execute full E2E verification suite (v1 + v2)"
	@echo "  make console-dev - Run React 19 Ops Console in Vite hot-reload dev mode"
	@echo "  make console-build - Build production React 19 Ops Console distribution bundle"
	@echo "  make docs-serve  - Serve live-reloading developer documentation"
	@echo "  make docs-build  - Build strict production documentation distribution"

dev:
	docker compose --profile dev up -d postgres redis mock-alpha mock-beta
	./gradlew bootRun

up:
	docker compose up -d --build

down:
	docker compose down -v

restart:
	docker compose restart gateway

logs:
	docker compose logs -f

ps:
	docker compose ps

build:
	./gradlew build -x test

test:
	./gradlew test

clean:
	./gradlew clean
	rm -rf site/

smoke:
	python3 scripts/smoke_test.py --url http://localhost:8080 --key netra-sk-search-1a2b3c --model fast

routing-eval:
	python3 scripts/run_routing_eval.py --url http://localhost:8080 --key netra-sk-research-4d5e6f

cache-eval:
	python3 scripts/run_cache_eval.py --url http://localhost:8080 --key netra-sk-search-1a2b3c

load:
	python3 scripts/load_test.py --url http://localhost:8080 --key netra-sk-free-7g8h9i --model fast --requests 30 --concurrency 10 --rpm-limit 10

chaos:
	python3 scripts/v2/chaos_drill.py --url http://localhost:8080

cache-fuzz:
	python3 scripts/v2/cache_fuzzer.py --url http://localhost:8080

stress:
	python3 scripts/v2/stress_test.py --url http://localhost:8080 --key netra-sk-search-1a2b3c --concurrency 10 --duration 5

verify-all: smoke routing-eval cache-eval load chaos cache-fuzz stress

console-dev:
	cd console && npm run dev

console-build:
	cd console && npm run build

console-serve:
	cd console && npm run preview -- --port 3000 --host 0.0.0.0

docs-serve: ## Serve documentation locally
	uv run --with zensical zensical serve

docs-build: ## Build static documentation site distribution
	uv run --with zensical zensical build --clean --strict
