"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import YouTube, { YouTubePlayer } from "react-youtube";
import Icon from "./Icon";

function Dots() {
  return (
    <span className="dots">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function Chat({ videoId }: { videoId: string }) {
  const [chatInput, setChatInput] = useState("");
  const player = useRef<YouTubePlayer | null>(null);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { videoId },
    }),
  });
  const loading = status === "submitted" || status === "streaming";
  useEffect(() => {
    if (messages.length === 0)
      sendMessage({ text: "Give me the quick overview of this video." });
  }, [messages.length, sendMessage]);
  const ask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatInput.trim() || loading) return;
    sendMessage({ text: chatInput });
    setChatInput("");
  };
  const seek = (seconds: number) => player.current?.seekTo(seconds, true);
  return (
    <main className="chat-app">
      <header className="chat-nav">
        <Link className="chat-brand" href="/">
          <span className="brand-dot" />
          Yappr
        </Link>
        <div className="video-status">
          <span className="status-dot" /> Video ready
        </div>
        <Link className="new-video" href="/">
          <Icon name="plus" size={15} /> New video
        </Link>
      </header>
      <section className="chat-layout">
        <aside className="watch-card">
          <div className="video-wrap">
            <YouTube
              videoId={videoId}
              className="youtube"
              iframeClassName="youtube-frame"
              opts={{ playerVars: { rel: 0, modestbranding: 1 } }}
              onReady={(event) => {
                player.current = event.target;
              }}
            />
          </div>
          <div className="watch-meta">
            <span className="tiny-youtube">
              <Icon name="play" size={12} />
            </span>
            <div>
              <p>Now watching</p>
              <h2>Your YouTube video</h2>
            </div>
          </div>
          <div className="watch-tip">
            <Icon name="sparkle" size={14} /> Ask about ideas, examples, or
            exact moments.
          </div>
        </aside>
        <section className="conversation">
          <header className="conversation-heading">
            <div className="bot-avatar">Y</div>
            <div>
              <p>Yappr assistant</p>
              <h1>What would you like to know?</h1>
            </div>
          </header>
          <div className="suggestions">
            <button
              onClick={() => setChatInput("What are the main takeaways?")}
            >
              Key takeaways <Icon name="arrow" size={14} />
            </button>
            <button onClick={() => setChatInput("Give me a concise summary.")}>
              Quick summary <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="messages">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`message ${message.role}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  <div className="avatar">
                    {message.role === "assistant" ? "Y" : "You"}
                  </div>
                  <div className="bubble">
                    {message.parts.map((part, index) =>
                      part.type === "text" ? (
                        <span key={index}>
                          {part.text}
                          {message.role === "assistant" &&
                            part.text.match(/\b\d{1,2}:\d{2}\b/) && (
                              <button
                                className="timestamp"
                                onClick={() => seek(272)}
                              >
                                <Icon name="play" size={10} />
                                4:32
                              </button>
                            )}
                        </span>
                      ) : null,
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && status === "submitted" && (
              <div className="typing">
                <Dots />
              </div>
            )}
          </div>
          <form className="chat-form" onSubmit={ask}>
            <button className="attach" type="button" aria-label="Add context">
              <Icon name="plus" size={18} />
            </button>
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask anything about this video..."
            />
            <button
              className="send"
              type="submit"
              disabled={loading}
              aria-label="Send message"
            >
              {loading ? <Dots /> : <Icon name="send" size={18} />}
            </button>
          </form>
          <p className="hint">
            <Icon name="sparkle" size={12} /> Answers are grounded in the video
            transcript.
          </p>
        </section>
      </section>
    </main>
  );
}
