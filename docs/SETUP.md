# Setup

This guide covers the local setup for Yappr's frontend and backend.

## Repository Structure

- `web/` - Next.js frontend.
- `server/` - FastAPI backend.
- `docs/` - repo documentation.

## Prerequisites

- Node.js 20 or newer.
- Python 3.13 or newer.
- OpenAI and Pinecone credentials.

## Frontend Setup

1. Install the shared root tooling first so Husky can register its hooks.

	```bash
	npm install
	```

2. Install the frontend dependencies.

	```bash
	cd web
	npm install
	```

3. Run the app.

	```bash
	npm run dev
	```

The frontend uses `NEXT_PUBLIC_YAPPR_API_URL` to point to the backend API. When not set, it defaults to `http://localhost:8000`.

## Backend Setup

1. Create and activate a Python virtual environment.

	```bash
	cd server
	python3 -m venv .venv
	source .venv/bin/activate
	```

2. Install backend dependencies.

	```bash
	pip install -r requirements.txt
	```

3. Copy the example environment file and fill in your secrets.

	```bash
	cp .env.example .env
	```

4. Start the API server.

	```bash
	uvicorn main:app --reload --port 8000
	```

## Environment Variables

The backend reads these settings from `server/.env`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_EMBEDDING_DIMENSIONS`
- `PINECONE_API_KEY`
- `PINECONE_CLOUD`
- `PINECONE_REGION`
- `CORS_ORIGINS`

Useful frontend variables:

- `YAPPR_API_BASE_URL` - server-side API base URL used by the Next.js API route.
- `NEXT_PUBLIC_YAPPR_API_URL` - browser-side API base URL used by the chat UI.

## Common Commands

- Frontend lint: `cd web && npm run lint`
- Frontend build: `cd web && npm run build`
- Backend syntax check: `cd server && python3 -m py_compile main.py`
- Pre-commit hook: run automatically through Husky after `npm install`

