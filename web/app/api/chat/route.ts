import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from "ai";

const apiBase = process.env.YAPPR_API_BASE_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const { messages, videoId }: { messages: UIMessage[]; videoId: string } = await request.json();
  
  const text = messages.at(-1)?.parts.find((part) => part.type === "text")?.text ?? "";
  
  const response = await fetch(`${apiBase}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId, message: text }),
  });

  if (!response.ok || !response.body)
    return new Response(await response.text(), {
      status: response.status || 500,
    });

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
