"use client";

import Link from "next/link";
import type { PrepStatus } from "../../lib/youtube";
import { STAGE_LABEL } from "./constants";
import Icon from "../Icon";

type NavbarProps = {
  videoId: string;
  prepStatus: PrepStatus;
  prepStage: string;
  videoOpen: boolean;
  onToggleVideo: () => void;
};

export default function Navbar({
  videoId,
  prepStatus,
  prepStage,
  videoOpen,
  onToggleVideo,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line-soft bg-shell/90 px-4 backdrop-blur-md sm:px-6">
      <Link
        href="/"
        className="group flex items-center gap-2.5 font-semibold tracking-tight"
      >
        <span className="relative grid size-7 place-items-center rounded-md bg-teal text-void transition-transform group-hover:scale-[1.03]">
          <span className="ml-0.5 border-y-[5px] border-l-[7px] border-y-transparent border-l-void" />
        </span>
        <span className="text-[15px]">Yappr</span>
      </Link>

      <div className="ml-1 hidden items-center gap-2 sm:flex">
        <span className="h-3 w-px bg-line" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          Session
        </span>
        <code className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted">
          {videoId.slice(0, 11)}
        </code>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {prepStatus === "ready" ? (
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-elevated px-2.5 py-1 text-[12px] text-muted sm:inline-flex">
            <span className="size-1.5 rounded-full bg-moss shadow-[0_0_0_3px_rgba(52,211,153,0.2)]" />
            Transcript ready
          </span>
        ) : prepStatus === "error" ? (
          <span className="hidden items-center gap-1.5 rounded-full border border-ember/30 bg-ember-soft px-2.5 py-1 text-[12px] text-ember sm:inline-flex">
            Can&apos;t process
          </span>
        ) : (
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-elevated px-2.5 py-1 text-[12px] text-muted sm:inline-flex">
            <span className="spin size-3 rounded-full border-2 border-line border-t-teal" />
            {STAGE_LABEL[prepStage] ?? "Indexing…"}
          </span>
        )}

        <button
          type="button"
          onClick={onToggleVideo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition hover:bg-raised lg:hidden"
        >
          <Icon name="play" size={12} />
          {videoOpen ? "Hide" : "Show"} video
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition hover:bg-raised"
        >
          <Icon name="plus" size={14} />
          <span className="hidden sm:inline">New video</span>
        </Link>
      </div>
    </header>
  );
}
