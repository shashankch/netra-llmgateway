# NETRA LLM Gateway - Developer Automation Makefile

.PHONY: all help dev up down restart logs ps smoke routing-eval cache-eval load test build clean docs-serve docs-build dashboard-dev dashboard-build

help:
	@echo "NETRA Developer CLI Commands:"
	@echo "  make dev         - Launch backing services in Docker and run gateway locally"
	@echo "  make up          - Build and start full containerized stack (gateway + backing + dashboard)"
	@echo "  make down        - Tear down all containers, networks, and persistent volumes"
	@echo "  make ps          - View status of all running services"
	@echo "  make logs        - Tail live container logs across all services"
	@echo "  make test        - Execute test suite via Gradle (Java 25)"
	@echo "  make smoke       - Run automated smoke test suite against running gateway"
	@echo "  make routing-eval - Run benchmark prompt difficulty routing eval"
	@echo "  make cache-eval  - Run semantic vector cache hit and isolation eval"
	@echo "  make load        - Run burst concurrency load test"
	@echo "  make dashboard-dev - Run React 19 Ops Console in Vite hot-reload dev mode"
	@echo "  make dashboard-build - Build production React 19 Ops Console distribution bundle"
	@echo "  make docs-serve  - Serve live-reloading Zensical developer documentation"
	@echo "  make docs-build  - Build strict production documentation artifacts via Zensical"

dev:
	docker compose up -d postgres redis mock-alpha mock-beta
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

smoke:
	python3 scripts/smoke_test.py --url http://localhost:8080 --key netra-sk-search-1a2b3c --model fast

routing-eval:
	python3 scripts/run_routing_eval.py --url http://localhost:8080 --key netra-sk-research-4d5e6f

cache-eval:
	python3 scripts/run_cache_eval.py --url http://localhost:8080 --key netra-sk-search-1a2b3c

load:
	python3 scripts/load_test.py --url http://localhost:8080 --key netra-sk-free-7g8h9i --model fast --requests 30 --concurrency 10 --rpm-limit 10

dashboard-dev:
	cd dashboard && npm run dev

dashboard-build:
	cd dashboard && npm run build

docs-serve:
	uv run --with zensical zensical serve

docs-build:
	uv run --with zensical zensical build --clean --strict
