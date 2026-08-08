import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yappr - Talk to any YouTube video",
  description: "Paste a YouTube link and ask about the moments that matter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: "#18181b",
              color: "#f4f4f5",
              border: "1px solid #2a2a2e",
              fontSize: "13px",
            },
            error: {
              style: {
                background: "#1c1010",
                color: "#fecaca",
                border: "1px solid rgba(240, 113, 103, 0.35)",
              },
            },
            success: {
              style: {
                background: "#0f1a14",
                color: "#bbf7d0",
                border: "1px solid rgba(52, 211, 153, 0.3)",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
