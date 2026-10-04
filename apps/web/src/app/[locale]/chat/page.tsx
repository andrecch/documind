"use client";
import { ChatPanel } from "@/components/chat-panel";
import { Navbar } from "@/components/navbar";

export default function ChatPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Navbar />
      <div className="mx-auto flex h-dvh w-full max-w-[760px] flex-col px-4 pb-6 pt-6">
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatPanel />
        </div>
      </div>
    </main>
  );
}
