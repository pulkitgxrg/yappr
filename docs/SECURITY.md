# Security Policy

## Reporting a Vulnerability

If you find a security issue in Yappr, please report it privately instead of opening a public issue or pull request.

Email the maintainer at [project.pulkitgarg@gmail.com](mailto:project.pulkitgarg@gmail.com) and include:

- A clear summary of the issue.
- The affected area of the app or API.
- Steps to reproduce.
- The impact and any proof of concept you are comfortable sharing.

## What Happens Next

- We will acknowledge the report as soon as practical.
- We will review, triage, and verify the issue.
- We will ship a fix or mitigation before public disclosure when possible.

## Supported Versions

Security fixes are handled for the current mainline version of the project.

## Security Notes for Contributors

- Do not commit secrets, API keys, or `.env` files.
- Keep dependencies updated when you touch areas that use them.
- Validate user input and external content carefully, especially in the backend ingestion path.
- Prefer least-privilege credentials for OpenAI and Pinecone.

## Responsible Disclosure

Please avoid public discussion of unpatched issues until a fix is available.