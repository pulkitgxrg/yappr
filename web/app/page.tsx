"use client";

import Input from "./components/Input";

export default function Home() {
  return (
    <main className="app">
      <div className="backdrop" />
      
      <nav className="brand">
        <span>YAPPR!</span>
      </nav>

      <Input />
    </main>
  );
}
