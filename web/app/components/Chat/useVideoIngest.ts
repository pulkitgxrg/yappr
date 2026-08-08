"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { readApiError } from "../../lib/api";
import {
  type PrepStatus,
  type VideoStatusResponse,
  youtubeWatchUrl,
} from "../../lib/youtube";
import { API_BASE } from "./constants";

export function useVideoIngest(videoId: string) {
  const [prepStatus, setPrepStatus] = useState<PrepStatus>("idle");
  const [prepStage, setPrepStage] = useState("queued");
  const [prepError, setPrepError] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState<number | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [ingestAttempt, setIngestAttempt] = useState(0);
  const toastedError = useRef<string | null>(null);

  const ready = prepStatus === "ready";

  const applyStatus = useCallback((payload: VideoStatusResponse) => {
    const next = payload.status as PrepStatus;
    if (next === "ready" || next === "processing" || next === "error") {
      setPrepStatus(next);
    } else if (payload.status === "unknown") {
      setPrepStatus("processing");
    }
    if (payload.stage) setPrepStage(payload.stage);
    if (typeof payload.chunks === "number") setChunkCount(payload.chunks);
    if (payload.detail) setPrepError(payload.detail);
    if (payload.status === "ready") setPrepError(null);
    if (payload.title) setTitle(payload.title);
    if (payload.description != null && payload.description !== "") {
      setDescription(payload.description);
    }
    if (payload.author) setAuthor(payload.author);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/videos/${videoId}`);
        if (!response.ok) {
          const msg = await readApiError(
            response,
            "Failed to check indexing status.",
          );
          if (!cancelled) {
            setPrepStatus("error");
            setPrepError(msg);
            if (toastedError.current !== msg) {
              toastedError.current = msg;
              toast.error(msg);
            }
          }
          return;
        }
        const payload = (await response.json()) as VideoStatusResponse;
        if (cancelled) return;
        applyStatus(payload);

        if (payload.status === "error" && payload.detail) {
          if (toastedError.current !== payload.detail) {
            toastedError.current = payload.detail;
            toast.error(payload.detail);
          }
          return;
        }
        if (payload.status === "ready") {
          if (!payload.title) {
            timer = window.setTimeout(async () => {
              try {
                const r = await fetch(`${API_BASE}/videos/${videoId}`);
                if (!r.ok || cancelled) return;
                applyStatus((await r.json()) as VideoStatusResponse);
              } catch {
                /* ignore */
              }
            }, 1500);
          }
          return;
        }

        timer = window.setTimeout(poll, 1200);
      } catch {
        if (cancelled) return;
        timer = window.setTimeout(poll, 2000);
      }
    };

    const start = async () => {
      setPrepStatus("processing");
      setPrepStage("queued");
      setPrepError(null);
      setTitle(null);
      setDescription(null);
      setAuthor(null);
      toastedError.current = null;

      try {
        const response = await fetch(`${API_BASE}/videos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: videoId,
            url: youtubeWatchUrl(videoId),
          }),
        });
        const raw = await response.text();
        let payload: VideoStatusResponse & { detail?: string } = {
          video_id: videoId,
          status: "error",
        };
        try {
          payload = JSON.parse(raw) as VideoStatusResponse & {
            detail?: string;
          };
        } catch {
        }

        if (cancelled) return;

        if (!response.ok) {
          const msg =
            typeof payload.detail === "string"
              ? payload.detail
              : raw.slice(0, 280) || "Could not start indexing for this video.";
          setPrepStatus("error");
          setPrepStage("error");
          setPrepError(msg);
          toast.error(msg);
          return;
        }

        applyStatus(payload);
        if (payload.status === "ready") {
          toast.success("Transcript ready");
          if (!payload.title) {
            timer = window.setTimeout(poll, 900);
          }
          return;
        }
        if (payload.status === "error") {
          const msg = payload.detail || "Indexing failed.";
          setPrepError(msg);
          toast.error(msg);
          return;
        }
        timer = window.setTimeout(poll, 900);
      } catch {
        if (cancelled) return;
        const msg =
          "Could not reach the Yappr API. Is the server running on port 8000?";
        setPrepStatus("error");
        setPrepStage("error");
        setPrepError(msg);
        toast.error(msg);
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [videoId, ingestAttempt, applyStatus]);

  const retry = useCallback(() => setIngestAttempt((n) => n + 1), []);

  return {
    prepStatus,
    prepStage,
    prepError,
    chunkCount,
    title,
    description,
    author,
    ready,
    retry,
  };
}
