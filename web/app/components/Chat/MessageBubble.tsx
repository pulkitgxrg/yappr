"use client";

import { motion } from "framer-motion";
import type { UIMessage } from "ai";
import Avatar from "./Avatar";
import MessageText from "./MessageText";

export default function MessageBubble({
  message,
  onSeek,
}: {
  message: UIMessage;
  onSeek: (seconds: number) => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <Avatar role={isUser ? "user" : "assistant"} />

      <div
        className={`max-w-[min(100%,34rem)] rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.55] ${
          isUser
            ? "rounded-tr-md bg-raised text-ink"
            : "rounded-tl-md border border-line bg-elevated text-ink-soft"
        }`}
      >
        {message.parts.map((part, index) =>
          part.type === "text" ? (
            <div key={index} className={isUser ? "whitespace-pre-wrap" : undefined}>
              <MessageText
                text={part.text}
                isAssistant={!isUser}
                onSeek={onSeek}
              />
            </div>
          ) : null,
        )}
      </div>
    </motion.div>
  );
}
