import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from "ai";

const apiBase = process.env.YAPPR_API_BASE_URL ?? "http://localhost:8000";
const HISTORY_LIMIT = 12;

async function errorDetail(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Chat failed (${response.status})`;
  try {
    const json = JSON.parse(text) as { detail?: unknown };
    if (typeof json.detail === "string") return json.detail;
  } catch {
  }
  return text.slice(0, 400);
}

function textFromMessage(message: UIMessage): string {
  return (
    message.parts
      ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("") ?? ""
  );
}

export async function POST(request: Request) {
  const { messages, videoId }: { messages: UIMessage[]; videoId: string } =
    await request.json();

  if (!videoId) {
    return new Response(JSON.stringify({ detail: "Missing videoId." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const last = messages.at(-1);
  const text = last ? textFromMessage(last) : "";

  const history = messages
    .slice(0, -1)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: textFromMessage(m).trim(),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-HISTORY_LIMIT);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        message: text,
        history,
      }),
    });
  } catch {
    return new Response(
      JSON.stringify({
        detail:
          "Could not reach the Yappr API. Is the server running on port 8000?",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!response.ok || !response.body) {
    const detail = await errorDetail(response);
    return new Response(JSON.stringify({ detail }), {
      status: response.status || 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = crypto.randomUUID();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      writer.write({ type: "text-start", id });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write({
          type: "text-delta",
          id,
          delta: decoder.decode(value, { stream: true }),
        });
      }
      writer.write({ type: "text-end", id });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
