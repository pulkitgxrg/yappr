"use client";

import { useState } from "react";
import YouTube, { type YouTubePlayer } from "react-youtube";
import type { PrepStatus } from "../../lib/youtube";
import { STAGE_LABEL } from "./constants";
import Icon from "../Icon";

type VideoPanelProps = {
  videoId: string;
  open: boolean;
  prepStatus: PrepStatus;
  prepStage: string;
  prepError: string | null;
  chunkCount: number | null;
  title: string | null;
  description: string | null;
  author: string | null;
  onPlayerReady: (player: YouTubePlayer) => void;
  onRetry: () => void;
};

export default function VideoPanel({
  videoId,
  open,
  prepStatus,
  prepStage,
  prepError,
  chunkCount,
  title,
  description,
  author,
  onPlayerReady,
  onRetry,
}: VideoPanelProps) {
  const [descOpen, setDescOpen] = useState(false);
  const displayTitle = title?.trim() || videoId;
  const desc = description?.trim() || "";
  const longDesc = desc.length > 180;

  return (
    <aside
      className={`${
        open ? "flex" : "hidden"
      } w-full shrink-0 flex-col border-b border-line-soft bg-shell lg:flex lg:h-full lg:w-[min(42%,440px)] lg:overflow-y-auto lg:border-b-0 lg:border-r`}
    >
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_12px_40px_-16px_rgba(0,0,0,0.6)]">
          <div className="aspect-video w-full bg-void">
            <YouTube
              videoId={videoId}
              className="youtube h-full w-full"
              iframeClassName="youtube-frame"
              opts={{
                width: "100%",
                height: "100%",
                playerVars: { rel: 0, modestbranding: 1 },
              }}
              onReady={(event) => onPlayerReady(event.target)}
            />
          </div>
        </div>

        <div className="flex items-start gap-3 px-0.5">
          <span className="mt-0.5 grid h-5 w-7 shrink-0 place-items-center rounded bg-[#e11d48] text-white">
            <Icon name="play" size={10} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Now watching
              {author ? (
                <span className="normal-case tracking-normal text-faint">
                  {" "}
                  · {author}
                </span>
              ) : null}
            </p>
            <h2
              className="mt-0.5 text-[14px] font-semibold leading-snug tracking-tight text-ink"
              title={displayTitle}
            >
              <span className="text-muted">YouTube · </span>
              {displayTitle}
            </h2>
            {desc ? (
              <div className="mt-1.5">
                <p
                  className={`text-[12px] leading-relaxed text-muted ${
                    descOpen ? "" : "line-clamp-3"
                  }`}
                >
                  {desc}
                </p>
                {longDesc && (
                  <button
                    type="button"
                    onClick={() => setDescOpen((v) => !v)}
                    className="mt-1 text-[11px] font-medium text-teal hover:underline"
                  >
                    {descOpen ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[12px] text-faint">
                {prepStatus === "processing"
                  ? "Loading video details…"
                  : "No description available."}
              </p>
            )}
          </div>
        </div>

        {prepStatus === "processing" && (
          <div className="rounded-xl border border-line bg-elevated p-3">
            <div className="flex items-center gap-2">
              <span className="spin size-3.5 shrink-0 rounded-full border-2 border-line border-t-teal" />
              <p className="text-[13px] font-medium text-ink-soft">
                Indexing transcript
              </p>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              {STAGE_LABEL[prepStage] ?? "Working…"} Chat unlocks when this
              finishes.
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-line-soft">
              <div
                className="h-full rounded-full bg-teal transition-all duration-500"
                style={{
                  width:
                    prepStage === "queued"
                      ? "12%"
                      : prepStage === "checking"
                        ? "28%"
                        : prepStage === "transcript"
                          ? "52%"
                          : prepStage === "embeddings"
                            ? "78%"
                            : "40%",
                }}
              />
            </div>
          </div>
        )}

        {prepStatus === "ready" && (
          <div className="hidden rounded-xl border border-dashed border-line bg-elevated/50 p-3 text-[12px] leading-relaxed text-muted lg:block">
            <p className="font-medium text-ink-soft">
              Ready{chunkCount != null ? ` · ${chunkCount} chunks` : ""}
            </p>
            <p className="mt-1">
              Tap a timestamp chip in answers to jump the player.
            </p>
          </div>
        )}

        {prepStatus === "error" && (
          <div className="rounded-xl border border-ember/25 bg-ember-soft p-3 text-[12px] leading-relaxed">
            <p className="font-medium text-ember">Can&apos;t process</p>
            <p className="mt-1 text-muted">
              {prepError ?? "Something went wrong while preparing this video."}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-[12px] font-medium text-ink transition hover:bg-raised"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
