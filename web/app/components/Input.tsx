"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

const apiBase =
  process.env.NEXT_PUBLIC_YAPPR_API_URL ?? "http://localhost:8000";

export default function Input() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [shortcut] = useState<"mac" | "windows">(() =>
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? "mac"
      : "windows",
  );

  const paste = async () => {
    try {
      setUrl(await navigator.clipboard.readText());
    } catch {
    }
  };

  const submitUrl = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/.test(
        url.trim(),
      )
    ) {
      setInvalid(true);
      window.setTimeout(() => setInvalid(false), 500);
      return;
    }
    setFetching(true);
    try {
      const youtubeUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;
      const response = await fetch(`${apiBase}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.detail ?? "We couldn't process that video.");
      router.push(`/chat/${payload.video_id}`);
    } catch {
      setInvalid(true);
      window.setTimeout(() => setInvalid(false), 2600);
    } finally {
      setFetching(false);
    }
  };

  return (
    <motion.section
      className="relative z-10 mx-auto flex min-h-[calc(100svh-72px)] w-full max-w-[720px] flex-col items-center px-6 pb-12 pt-16 text-center sm:pt-24"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
        Transcript-native chat
      </p>

      <h1 className="max-w-[18ch] text-[clamp(2.4rem,6.5vw,3.75rem)] font-semibold leading-[1.08] tracking-[-0.04em]">
        Ask anything about any video,{" "}
        <span className="relative inline-block opacity-90">
          instantly
          <svg
            className="hero-scribble pointer-events-none absolute -left-[8%] -top-[12%] h-[130%] w-[118%] overflow-visible"
            viewBox="0 0 210 74"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d="M9 39C9 13 189 2 201 30c15 38-173 57-191 12" />
          </svg>
        </span>
      </h1>

      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
        Paste a YouTube link. Yappr reads the transcript so you can search
        moments, claims, and details in plain language.
      </p>

      <motion.form
        className="relative mt-10 w-full"
        onSubmit={submitUrl}
        animate={invalid ? { x: [-8, 8, -5, 5, 0] } : undefined}
        transition={invalid ? { duration: 0.4 } : undefined}
      >
        <div className="flex flex-col gap-2 rounded-2xl border border-white/20 bg-white/[0.09] p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-md sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-white/75">
            <Icon name="paste" size={18} />
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste a YouTube link"
              aria-label="YouTube link"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/45"
            />
            <button
              className="hidden items-center gap-1 text-white/55 transition-colors hover:text-white sm:inline-flex"
              type="button"
              onClick={paste}
              aria-label="Paste from clipboard"
            >
              {shortcut === "mac" ? (
                <>
                  <kbd className="grid min-w-[22px] place-items-center rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] font-medium">
                    ⌘
                  </kbd>
                  <kbd className="grid min-w-[22px] place-items-center rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] font-medium">
                    V
                  </kbd>
                </>
              ) : (
                <>
                  <kbd className="grid min-w-[22px] place-items-center rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] font-medium">
                    Ctrl
                  </kbd>
                  <kbd className="grid min-w-[22px] place-items-center rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] font-medium">
                    V
                  </kbd>
                </>
              )}
            </button>
          </div>

          <button
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[14px] font-semibold text-night transition hover:bg-white/92 disabled:opacity-80"
            type="submit"
            disabled={fetching}
          >
            {fetching ? (
              <>
                <span className="spin size-3.5 rounded-full border-2 border-night/25 border-t-night" />
                Fetching transcript…
              </>
            ) : (
              <>
                Start chatting
                <Icon name="arrow" size={17} />
              </>
            )}
          </button>
        </div>

        {invalid && (
          <p className="absolute left-1 right-1 top-full mt-2 text-left text-[12px] text-rose-200 sm:text-center">
            Couldn&apos;t process that link. Check the URL and make sure the API
            is running.
          </p>
        )}
      </motion.form>

      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
        Private to this session · No account required
      </p>
    </motion.section>
  );
}
