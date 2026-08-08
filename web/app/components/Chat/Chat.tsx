"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { YouTubePlayer } from "react-youtube";
import toast from "react-hot-toast";
import Composer from "./Composer";
import MessageList from "./MessageList";
import Navbar from "./Navbar";
import VideoPanel from "./VideoPanel";
import { useVideoIngest } from "./useVideoIngest";

export default function Chat({ videoId }: { videoId: string }) {
  const [chatInput, setChatInput] = useState("");
  const [videoOpen, setVideoOpen] = useState(true);
  const overviewSent = useRef(false);
  const player = useRef<YouTubePlayer | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    prepStatus,
    prepStage,
    prepError,
    chunkCount,
    title,
    description,
    author,
    ready,
    retry,
  } = useVideoIngest(videoId);

  const {
    messages,
    sendMessage,
    status,
    error: chatError,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { videoId },
    }),
  });

  const loading = status === "submitted" || status === "streaming";
  const isSubmitting = status === "submitted";
  const hasUserMessage = useMemo(
    () => messages.some((m) => m.role === "user"),
    [messages],
  );

  useEffect(() => {
    if (!ready || overviewSent.current || messages.length > 0) return;
    overviewSent.current = true;
    sendMessage({ text: "Give me the quick overview of this video." });
  }, [ready, messages.length, sendMessage]);

  useEffect(() => {
    overviewSent.current = false;
  }, [videoId]);

  useEffect(() => {
    if (!chatError) return;
    const msg =
      chatError.message?.replace(/^Error:\s*/i, "") ||
      "Chat request failed. Try again.";
    toast.error(
      msg.includes("indexed") || msg.includes("Yappr")
        ? msg
        : msg.length > 8
          ? msg
          : "Chat failed. The video may still be indexing.",
    );
  }, [chatError]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, prepStatus]);

  const ask = (event: React.FormEvent) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || loading || !ready) {
      if (!ready) {
        toast.error(
          prepError ||
            "Video is still being indexed. Wait until it’s ready to chat.",
        );
      }
      return;
    }
    sendMessage({ text });
    setChatInput("");
  };

  const askSuggestion = (text: string) => {
    if (loading || !ready) {
      if (!ready) {
        toast.error(
          prepError ||
            "Video is still being indexed. Wait until it’s ready to chat.",
        );
      }
      return;
    }
    sendMessage({ text });
    setChatInput("");
  };

  const seek = (seconds: number) => {
    const yt = player.current;
    if (!yt) {
      toast.error("Video player isn’t ready yet.");
      return;
    }

    yt.seekTo(seconds, true);
    try {
      yt.playVideo();
    } catch {
    }
  };

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-void text-ink">
      <Navbar
        videoId={videoId}
        prepStatus={prepStatus}
        prepStage={prepStage}
        videoOpen={videoOpen}
        onToggleVideo={() => setVideoOpen((v) => !v)}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col lg:flex-row">
        <VideoPanel
          videoId={videoId}
          open={videoOpen}
          prepStatus={prepStatus}
          prepStage={prepStage}
          prepError={prepError}
          chunkCount={chunkCount}
          title={title}
          description={description}
          author={author}
          onPlayerReady={(p) => {
            player.current = p;
          }}
          onRetry={retry}
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-void">
          <MessageList
            messages={messages}
            ready={ready}
            prepStatus={prepStatus}
            loading={loading}
            isSubmitting={isSubmitting}
            hasUserMessage={hasUserMessage}
            onSuggestion={askSuggestion}
            onSeek={seek}
            bottomRef={bottomRef}
          />

          <Composer
            value={chatInput}
            onChange={setChatInput}
            onSubmit={ask}
            ready={ready}
            prepStatus={prepStatus}
            prepStage={prepStage}
            loading={loading}
            isSubmitting={isSubmitting}
            inputRef={inputRef}
          />
        </section>
      </div>
    </div>
  );
}
