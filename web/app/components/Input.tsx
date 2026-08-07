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
    } catch {}
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
      className="hero"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1>
        Ask anything about
        <br />
        any video,{" "}
        <span className="circled">
          instantly
          <svg viewBox="0 0 210 74" preserveAspectRatio="none">
            <path d="M9 39C9 13 189 2 201 30c15 38-173 57-191 12" />
          </svg>
        </span>
      </h1>
      <p className="hero-copy">
        Paste a link and Yappr makes the important moments searchable, clear,
        and conversational.
      </p>
      <motion.form
        className="link-card"
        onSubmit={submitUrl}
        animate={invalid ? { x: [-10, 10, -7, 7, 0] } : { y: [0, -5, 0] }}
        transition={
          invalid
            ? { duration: 0.42 }
            : { repeat: Infinity, duration: 3.8, ease: "easeInOut" }
        }
      >
        <div className="link-input">
          <Icon name="paste" />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
          />
          <button
            className="paste-shortcut"
            type="button"
            onClick={paste}
            aria-label="Paste from clipboard"
          >
            {shortcut === "mac" ? (
              <>
                <b>⌘</b>
                <b>V</b>
              </>
            ) : (
              <>
                <b>⊞</b>
                <b>V</b>
              </>
            )}
          </button>
        </div>
        <button className="primary" type="submit" disabled={fetching}>
          {fetching ? (
            <>
              <span className="spinner" />
              Fetching transcript...
            </>
          ) : (
            <>
              Start chatting <Icon name="arrow" size={18} />
            </>
          )}
        </button>
        {invalid && (
          <span className="error">
            Couldn’t process that link. Check the URL and make sure the API is
            running.
          </span>
        )}
      </motion.form>
      <div className="trust">
        <span>✦</span> Your transcript is private to this conversation
      </div>
    </motion.section>
  );
}
