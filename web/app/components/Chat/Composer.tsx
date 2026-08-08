"use client";

import type { PrepStatus } from "../../lib/youtube";
import Dots from "./Dots";
import Icon from "../Icon";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  ready: boolean;
  prepStatus: PrepStatus;
  prepStage: string;
  loading: boolean;
  isSubmitting: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

export default function Composer({
  value,
  onChange,
  onSubmit,
  ready,
  prepStatus,
  loading,
  isSubmitting,
  inputRef,
}: ComposerProps) {
  return (
    <div className="sticky bottom-0 z-30 shrink-0 border-t border-line-soft bg-shell/95 backdrop-blur-md">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-2xl items-end gap-2 px-4 py-3 sm:px-6"
      >
        <div
          className={`flex min-w-0 flex-1 items-center gap-1 rounded-2xl border bg-elevated px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-teal/30 focus-within:shadow-[0_0_0_3px_var(--color-teal-glow)] ${
            ready ? "border-line" : "border-line opacity-80"
          }`}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              ready
                ? "Ask about anything related to the video…"
                : prepStatus === "error"
                  ? "Indexing failed - retry to chat"
                  : "Indexing transcript… chat unlocks soon"
            }
            aria-label="Message"
            disabled={!ready || (loading && isSubmitting)}
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[14px] text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!ready || loading || !value.trim()}
            aria-label="Send message"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal text-void transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {loading && isSubmitting ? (
              <Dots className="text-void" />
            ) : (
              <Icon name="send" size={16} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
