"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import Icon from "../Icon";

function parseTimestamp(match: string): number {
  const parts = match.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseYoutubeTimeParam(raw: string): number | null {
  const value = decodeURIComponent(raw).trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);

  const h = value.match(/(\d+)h/i);
  const m = value.match(/(\d+)m/i);
  const s = value.match(/(\d+)s/i);
  if (h || m || s) {
    return (
      (h ? Number(h[1]) * 3600 : 0) +
      (m ? Number(m[1]) * 60 : 0) +
      (s ? Number(s[1]) : 0)
    );
  }

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) return parseTimestamp(value);
  return null;
}

function secondsFromHref(href: string | undefined): number | null {
  if (!href) return null;
  try {
    const url = new URL(href, "https://example.invalid");
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const isYoutube =
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "example.invalid";

    const t =
      url.searchParams.get("t") ||
      url.searchParams.get("start") ||
      (url.hash.startsWith("#t=") ? url.hash.slice(3) : null);

    if (t) {
      const secs = parseYoutubeTimeParam(t);
      if (secs != null) return secs;
    }

    if (isYoutube && t) {
      return parseYoutubeTimeParam(t);
    }
  } catch {
    /* ignore */
  }

  const m = href.match(/[?&#](?:t|start)=([\w:]+)/i);
  if (m) return parseYoutubeTimeParam(m[1]);
  return null;
}

const TS_RE = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;

function TimestampChip({
  stamp,
  onSeek,
}: {
  stamp: string;
  onSeek: (seconds: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSeek(parseTimestamp(stamp));
      }}
      className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-line bg-raised px-1.5 py-0.5 align-middle font-mono text-[11px] font-medium text-teal transition-colors hover:border-teal/40 hover:bg-teal/10"
    >
      <Icon name="play" size={9} />
      {stamp}
    </button>
  );
}

function withTimestampChips(
  text: string,
  onSeek: (seconds: number) => void,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TS_RE.source, "g");
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const stamp = m[1];
    nodes.push(
      <TimestampChip key={`ts-${key++}`} stamp={stamp} onSeek={onSeek} />,
    );
    last = m.index + stamp.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function injectTimestamps(
  children: ReactNode,
  onSeek: (seconds: number) => void,
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return withTimestampChips(child, onSeek);
    }
    if (typeof child === "number") {
      return child;
    }
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children != null) {
      return cloneElement(child, {
        ...child.props,
        children: injectTimestamps(child.props.children, onSeek),
      });
    }
    return child;
  });
}

function markdownComponents(onSeek: (seconds: number) => void): Components {
  return {
    p: ({ children }) => (
      <p className="mb-2.5 last:mb-0 leading-[1.55]">
        {injectTimestamps(children, onSeek)}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-ink">
        {injectTimestamps(children, onSeek)}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-ink-soft">
        {injectTimestamps(children, onSeek)}
      </em>
    ),
    ul: ({ children }) => (
      <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">
        {injectTimestamps(children, onSeek)}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">
        {injectTimestamps(children, onSeek)}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-[1.5]">{injectTimestamps(children, onSeek)}</li>
    ),
    h1: ({ children }) => (
      <h3 className="mb-1.5 mt-2 text-[15px] font-semibold text-ink first:mt-0">
        {injectTimestamps(children, onSeek)}
      </h3>
    ),
    h2: ({ children }) => (
      <h3 className="mb-1.5 mt-2 text-[14.5px] font-semibold text-ink first:mt-0">
        {injectTimestamps(children, onSeek)}
      </h3>
    ),
    h3: ({ children }) => (
      <h4 className="mb-1 mt-2 text-[14px] font-semibold text-ink first:mt-0">
        {injectTimestamps(children, onSeek)}
      </h4>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mb-2.5 border-l-2 border-line pl-3 text-muted last:mb-0">
        {injectTimestamps(children, onSeek)}
      </blockquote>
    ),
    code: ({ className, children, ...rest }) => {
      const isBlock = Boolean(className?.includes("language-"));
      if (isBlock) {
        return (
          <code
            className="block overflow-x-auto rounded-lg bg-raised px-3 py-2 font-mono text-[12px] text-ink-soft"
            {...rest}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          className="rounded bg-raised px-1 py-0.5 font-mono text-[12px] text-ink-soft"
          {...rest}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="mb-2.5 overflow-x-auto last:mb-0">{children}</pre>
    ),
    a: ({ href, children }) => {
      const seekSeconds = secondsFromHref(href);

      if (seekSeconds != null) {
        const label =
          typeof children === "string" && children.trim()
            ? children
            : href?.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] ||
              formatSeconds(seekSeconds);

        return (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSeek(seekSeconds);
            }}
            className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-line bg-raised px-1.5 py-0.5 align-middle font-mono text-[11px] font-medium text-teal transition-colors hover:border-teal/40 hover:bg-teal/10"
          >
            <Icon name="play" size={9} />
            {label}
          </button>
        );
      }

      if (href && /youtu(\.be|be\.com)/i.test(href)) {
        return (
          <span className="text-ink-soft">{injectTimestamps(children, onSeek)}</span>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-teal underline-offset-2 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </a>
      );
    },
    hr: () => <hr className="my-3 border-line-soft" />,
  };
}

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MessageText({
  text,
  isAssistant,
  onSeek,
}: {
  text: string;
  isAssistant: boolean;
  onSeek: (seconds: number) => void;
}) {
  if (!isAssistant) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  return (
    <div className="chat-md break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents(onSeek)}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
