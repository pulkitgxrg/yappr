"use client";

import { AnimatePresence } from "framer-motion";
import type { UIMessage } from "ai";
import type { PrepStatus } from "../../lib/youtube";
import { SUGGESTIONS } from "./constants";
import Avatar from "./Avatar";
import Dots from "./Dots";
import MessageBubble from "./MessageBubble";

type MessageListProps = {
  messages: UIMessage[];
  ready: boolean;
  prepStatus: PrepStatus;
  loading: boolean;
  isSubmitting: boolean;
  hasUserMessage: boolean;
  onSuggestion: (text: string) => void;
  onSeek: (seconds: number) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
};

export default function MessageList({
  messages,
  ready,
  prepStatus,
  loading,
  isSubmitting,
  hasUserMessage,
  onSuggestion,
  onSeek,
  bottomRef,
}: MessageListProps) {
  return (
    <div className="messages-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-6 pt-6 sm:px-6">
        {!hasUserMessage && (
          <div className="mb-6 border-b border-line-soft pb-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Yappr
            </p>
            <h1 className="mt-2 text-[22px] font-semibold leading-snug tracking-tight sm:text-[26px]">
              {ready
                ? "Ask about this video."
                : prepStatus === "error"
                  ? "This video can’t be processed."
                  : "Indexing in progress…"}
            </h1>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">
              {ready
                ? "Answers stay grounded in the transcript — summaries, claims, and exact moments."
                : prepStatus === "error"
                  ? "You can still watch the video. Retry indexing when you’re ready."
                  : "The player is live. We’re fetching the transcript and building embeddings before chat unlocks."}
            </p>

            {ready && (
              <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => onSuggestion(s)}
                    className="rounded-full border border-line bg-elevated px-3 py-1.5 text-[12.5px] text-ink-soft transition hover:bg-raised disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-5">
          {prepStatus === "processing" && messages.length === 0 && (
            <div className="flex gap-2.5">
              <Avatar role="assistant" />
              <div className="rounded-2xl rounded-tl-md border border-line bg-elevated px-3.5 py-2.5 text-[14px] leading-relaxed text-muted">
                <span className="inline-flex items-center gap-2">
                  <Dots className="text-teal" />
                  Indexing transcript before we chat…
                </span>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onSeek={onSeek}
              />
            ))}
          </AnimatePresence>

          {loading && isSubmitting && (
            <div className="flex gap-2.5">
              <Avatar role="assistant" />
              <div className="rounded-2xl rounded-tl-md border border-line bg-elevated px-4 py-3 text-muted">
                <Dots className="text-teal" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
