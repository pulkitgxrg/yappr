# Contributing to Yappr

Thanks for helping improve Yappr.

## Before You Start

- Read [docs/SETUP.md](SETUP.md) so your local environment matches the project.
- Make sure the frontend lint and backend syntax checks pass before opening a pull request.
- Keep changes focused and avoid unrelated formatting churn.

## Workflow

1. Create a branch for your work.

   ```bash
   git checkout -b feature/your-change
   ```

2. Make your changes in the relevant app or docs folder.

3. Run the local checks.

   ```bash
   cd web && npm run lint && npm run build
   cd ../server && python3 -m py_compile main.py
   ```

4. Commit with a clear message.

   ```bash
   git commit -m "feat: describe your change"
   ```

5. Open a pull request against `main`.

## What Helps Most

- Bug fixes in the chat flow or ingestion pipeline.
- Improvements to transcript handling, error states, or retry behavior.
- UI polish, accessibility fixes, and layout improvements.
- Documentation updates that make setup and troubleshooting easier.

## Guidelines

- Follow the code style already used in the repo.
- Keep pull requests small and reviewable.
- Update docs when behavior or setup changes.
- Prefer Conventional Commits where practical.

## Review Expectations

- Be ready to explain why a change is needed and how you tested it.
- Address review feedback before merging.

## Code of Conduct

Be respectful, constructive, and professional in issues, pull requests, and reviews.