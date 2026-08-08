const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,}$/;

export function extractVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_RE.test(trimmed) && !trimmed.includes("/") && !trimmed.includes(".")) {
    return trimmed;
  }

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return VIDEO_ID_RE.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v") ?? "";
        return VIDEO_ID_RE.test(id) ? id : null;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      if (
        parts.length >= 2 &&
        ["embed", "shorts", "live", "v"].includes(parts[0]) &&
        VIDEO_ID_RE.test(parts[1])
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export type PrepStatus = "idle" | "processing" | "ready" | "error";

export type VideoStatusResponse = {
  video_id: string;
  status: string;
  stage?: string;
  chunks?: number;
  detail?: string;
  title?: string;
  description?: string;
  author?: string;
};
