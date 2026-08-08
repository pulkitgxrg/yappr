"use client";

import Input from "./components/Input";
import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-bg relative min-h-svh overflow-hidden text-white">
      <nav className="relative z-10 mx-auto flex h-[72px] w-full max-w-[1100px] items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="text-[15px]">YAPPR!</span>
        </Link>
      </nav>

      <Input />
    </main>
  );
}
