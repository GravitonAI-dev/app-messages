# Production server: compose.yaml with .env (and .env.prod below it).
# Local, compiled: compose.prod.local.yaml on top, with .env.prod.local only.
LOCAL := docker compose -f compose.yaml -f compose.prod.local.yaml --env-file .env.prod.local

.PHONY: up down logs up-local down-local logs-local config-local reload-local

up:
	docker compose pull && docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

up-local:
	$(LOCAL) up -d --build

down-local:
	$(LOCAL) down

logs-local:
	$(LOCAL) logs -f

# The merged configuration the local stack runs with (check before up-local).
config-local:
	$(LOCAL) config

# Reloads the mounted content (a message edited in this clone) without restarting.
reload-local:
	@. ./.env.prod.local && curl -fsS -X POST -H "x-reload-token: $$RELOAD_TOKEN" "http://127.0.0.1:$$HOST_PORT/internal/reload" && echo
