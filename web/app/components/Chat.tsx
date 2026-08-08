"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import YouTube, { YouTubePlayer } from "react-youtube";
import Icon from "./Icon";

function Dots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <i className="dot-bounce block size-1 rounded-full bg-current" />
      <i className="dot-bounce block size-1 rounded-full bg-current" />
      <i className="dot-bounce block size-1 rounded-full bg-current" />
    </span>
  );
}

function parseTimestamp(match: string): number {
  const parts = match.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function MessageText({
  text,
  isAssistant,
  onSeek,
}: {
  text: string;
  isAssistant: boolean;
  onSeek: (seconds: number) => void;
}) {
  if (!isAssistant) return <>{text}</>;

  const re = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const stamp = m[1];
    nodes.push(
      <button
        key={`ts-${key++}`}
        type="button"
        onClick={() => onSeek(parseTimestamp(stamp))}
        className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 align-middle font-mono text-[11px] font-medium text-ink transition-colors hover:border-ember hover:bg-ember-soft hover:text-ember"
      >
        <Icon name="play" size={9} />
        {stamp}
      </button>,
    );
    last = m.index + stamp.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

const SUGGESTIONS = [
  "What are the main takeaways?",
  "Give me a concise summary.",
  "Any surprising claims?",
] as const;

export default function Chat({ videoId }: { videoId: string }) {
  const [chatInput, setChatInput] = useState("");
  const [videoOpen, setVideoOpen] = useState(true);
  const player = useRef<YouTubePlayer | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { videoId },
    }),
  });

  const loading = status === "submitted" || status === "streaming";
  const hasUserMessage = useMemo(
    () => messages.some((m) => m.role === "user"),
    [messages],
  );

  useEffect(() => {
    if (messages.length === 0) {
      sendMessage({ text: "Give me the quick overview of this video." });
    }
  }, [messages.length, sendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const ask = (event: React.FormEvent) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || loading) return;
    sendMessage({ text });
    setChatInput("");
  };

  const askSuggestion = (text: string) => {
    if (loading) return;
    sendMessage({ text });
    setChatInput("");
  };

  const seek = (seconds: number) => player.current?.seekTo(seconds, true);

  return (
    <div className="flex min-h-svh flex-col bg-paper text-ink">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-cream/90 px-4 backdrop-blur-md sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="relative grid size-7 place-items-center rounded-md bg-ink text-cream transition-transform group-hover:scale-[1.03]">
            <span className="ml-0.5 border-y-[5px] border-l-[7px] border-y-transparent border-l-cream" />
          </span>
          <span className="text-[15px]">Yappr</span>
        </Link>

        <div className="ml-1 hidden items-center gap-2 sm:flex">
          <span className="h-3 w-px bg-line-strong" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            Session
          </span>
          <code className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">
            {videoId.slice(0, 11)}
          </code>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-muted sm:inline-flex">
            <span className="size-1.5 rounded-full bg-moss shadow-[0_0_0_3px_rgba(47,107,79,0.15)]" />
            Transcript ready
          </span>

          <button
            type="button"
            onClick={() => setVideoOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-cream lg:hidden"
          >
            <Icon name="play" size={12} />
            {videoOpen ? "Hide" : "Show"} video
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-cream"
          >
            <Icon name="plus" size={14} />
            <span className="hidden sm:inline">New video</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-0 lg:flex-row">
        <aside
          className={`${
            videoOpen ? "flex" : "hidden"
          } w-full shrink-0 flex-col border-b border-line bg-cream lg:flex lg:w-[min(42%,440px)] lg:border-b-0 lg:border-r`}
        >
          <div className="sticky top-14 flex flex-col gap-3 p-3 sm:p-4 lg:min-h-[calc(100svh-3.5rem)]">
            <div className="overflow-hidden rounded-xl border border-line bg-ink shadow-[0_12px_40px_-16px_rgba(20,18,15,0.45)]">
              <div className="aspect-video w-full bg-night">
                <YouTube
                  videoId={videoId}
                  className="youtube h-full w-full"
                  iframeClassName="youtube-frame"
                  opts={{
                    width: "100%",
                    height: "100%",
                    playerVars: { rel: 0, modestbranding: 1 },
                  }}
                  onReady={(event) => {
                    player.current = event.target;
                  }}
                />
              </div>
            </div>

            <div className="flex items-start gap-3 px-0.5">
              <span className="mt-0.5 grid h-5 w-7 shrink-0 place-items-center rounded bg-ember text-white">
                <Icon name="play" size={10} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  Now watching
                </p>
                <h2 className="mt-0.5 truncate text-[14px] font-semibold tracking-tight text-ink">
                  YouTube · {videoId}
                </h2>
              </div>
            </div>

            <div className="mt-auto hidden rounded-xl border border-dashed border-line-strong bg-surface/70 p-3 text-[12px] leading-relaxed text-muted lg:block">
              <p className="font-medium text-ink-soft">Jump with timestamps</p>
              <p className="mt-1">
                When answers cite a moment, tap the time chip to scrub the
                player.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper">
          <div className="messages-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-4 pt-6 sm:px-6">
              {!hasUserMessage && (
                <div className="mb-6 border-b border-line pb-6">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                    Yappr
                  </p>
                  <h1 className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-ink sm:text-[26px]">
                    Ask about this video.
                  </h1>
                  <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">
                    Answers stay grounded in the transcript — summaries,
                    claims, and exact moments.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={loading}
                        onClick={() => askSuggestion(s)}
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:border-line-strong hover:bg-cream disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-5">
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <div
                          className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${
                            isUser
                              ? "bg-ink text-cream"
                              : "border border-line bg-surface text-muted"
                          }`}
                          aria-hidden
                        >
                          {isUser ? "You" : "Y"}
                        </div>

                        <div
                          className={`max-w-[min(100%,34rem)] rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.55] ${
                            isUser
                              ? "rounded-tr-md bg-ink text-cream"
                              : "rounded-tl-md border border-line bg-surface text-ink-soft shadow-[0_1px_0_rgba(20,18,15,0.03)]"
                          }`}
                        >
                          {message.parts.map((part, index) =>
                            part.type === "text" ? (
                              <span key={index} className="whitespace-pre-wrap">
                                <MessageText
                                  text={part.text}
                                  isAssistant={!isUser}
                                  onSeek={seek}
                                />
                              </span>
                            ) : null,
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {loading && status === "submitted" && (
                  <div className="flex gap-2.5">
                    <div
                      className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface text-[10px] font-semibold text-muted"
                      aria-hidden
                    >
                      Y
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 text-muted">
                      <Dots />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-cream/95 backdrop-blur-sm">
            <form
              onSubmit={ask}
              className="mx-auto flex w-full max-w-2xl items-end gap-2 px-4 py-3 sm:px-6"
            >
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-1.5 shadow-[0_1px_2px_rgba(20,18,15,0.04)] transition-[border-color,box-shadow] focus-within:border-ink/25 focus-within:shadow-[0_0_0_3px_rgba(20,18,15,0.06)]">
                <input
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about a moment, claim, or detail…"
                  aria-label="Message"
                  disabled={loading && status === "submitted"}
                  className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[14px] text-ink outline-none placeholder:text-faint disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={loading || !chatInput.trim()}
                  aria-label="Send message"
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-cream transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {loading && status === "submitted" ? (
                    <Dots className="text-cream" />
                  ) : (
                    <Icon name="send" size={16} />
                  )}
                </button>
              </div>
            </form>
            <p className="mx-auto max-w-2xl px-4 pb-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-faint sm:px-6 sm:text-left">
              Grounded in this video&apos;s transcript
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
