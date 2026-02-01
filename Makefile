SHELL := /bin/bash
.PHONY: backend frontend db-up db-down db-destroy venv-init db-create

db-up:
		cd infra && docker compose up -d

db-create:
		cd backend && python3 create_db_tables.py

db-migrate:
		cd backend && python3 -m migrations.0001_add_review_author_fk && python3 -m migrations.0002_add_user_photo_file_id

db-down:
		cd infra && docker compose down

db-destroy:
		cd infra && docker-compose down -v && docker-compose down --rmi all

backend: 
		cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

frontend:
		cd frontend && npm install && npm run dev

venv-init:
		cd backend && /usr/bin/python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt