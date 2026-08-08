# Yappr

Chat with any YouTube video. Yappr pulls the video's transcript, embeds it into a vector store, and lets you ask questions about the content with timestamped answers.

## How it works
1. Ingest: send a YouTube URL or video ID. Yappr fetches the transcript, splits it into overlapping chunks, embeds them, and upserts them into a per-video Pinecone namespace. This runs in the background.
2. Status: poll while ingestion is in progress (`queued` → `transcript` → `embeddings` → `ready`).
3. Chat: ask a question. For specific questions, Yappr does an vector search over the transcript chunks. The answer streams back token by token, with timestamps cited in M:SS format.

## Quick Links

- [Setup](docs/SETUP.md)
- [Contributing](docs/CONTRIBUTION.md)
- [Security](docs/SECURITY.md)
- [Issue template](.github/ISSUE_TEMPLATE/bug_report.yml)
- [Pull request template](.github/PULL_REQUEST_TEMPLATE.md)

## Tech stack
- NextJS: Used to make UI for web
- FastAPI: HTTP API, background ingestion via a thread pool
- LangChain: text splitting, vector store interface, chat orchestration
- Pinecone (serverless): vector storage, one namespace per video

### Contributing
We appreciate your interest in contributing to Yappr! Your contributions help us improve and grow. Please feel free to submit pull requests, report issues, or suggest new features. Your feedback and participation are highly valued as we continue to develop and enhance the platform.

For detailed guidelines on how to contribute, please see our [CONTRIBUTING](./docs/CONTRIBUTION.md) file.

### License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.