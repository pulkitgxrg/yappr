export const SUGGESTIONS = [
  "What are the main takeaways?",
  "Give me a concise summary.",
  "Any surprising claims?",
] as const;

export const STAGE_LABEL: Record<string, string> = {
  queued: "Queued…",
  checking: "Checking cache…",
  transcript: "Fetching transcript…",
  embeddings: "Building embeddings…",
  ready: "Ready",
  error: "Failed",
  unknown: "Preparing…",
};

export const API_BASE = process.env.NEXT_PUBLIC_YAPPR_API_URL ?? "http://localhost:8000";
