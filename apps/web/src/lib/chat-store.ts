import { create } from "zustand";
import type { Citation } from "@documind/shared";

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type ChatState = {
  sessionId: string | null;
  messages: ChatMessageView[];
  streaming: boolean;
  startStreaming: () => void;
  stopStreaming: () => void;
  appendMessage: (message: ChatMessageView) => void;
  updateStreamingAssistant: (text: string) => void;
  finishAssistant: (messageId: string, citations: Citation[], sessionId: string) => void;
  setSession: (sessionId: string) => void;
  reset: () => void;
};

export const useChat = create<ChatState>((set) => ({
  sessionId: null,
  messages: [],
  streaming: false,
  startStreaming: () => set({ streaming: true }),
  stopStreaming: () => set({ streaming: false }),
  appendMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateStreamingAssistant: (text) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = { ...last, content: last.content + text };
      } else {
        messages.push({ id: `streaming-${messages.length}`, role: "assistant", content: text });
      }
      return { messages };
    }),
  finishAssistant: (messageId, citations, sessionId) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = { ...last, id: messageId, citations };
      }
      return { messages, sessionId, streaming: false };
    }),
  setSession: (sessionId) => set({ sessionId }),
  reset: () => set({ sessionId: null, messages: [], streaming: false }),
}));
