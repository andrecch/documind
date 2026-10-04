"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SendHorizonal } from "lucide-react";
import type { Citation } from "@documind/shared";
import { api, ApiError } from "@/lib/api";
import { errorText } from "@/lib/error-text";
import { useChat } from "@/lib/chat-store";
import { useActiveDoc } from "@/lib/store";

export function ChatPanel() {
  const t = useTranslations("chat");
  const tt = useTranslations("review");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const setDoc = useActiveDoc((s) => s.set);

  const sessionId = useChat((s) => s.sessionId);
  const messages = useChat((s) => s.messages);
  const streaming = useChat((s) => s.streaming);

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || streaming) return;
    setError(null);
    setDraft("");
    useChat.getState().startStreaming();
    useChat.getState().appendMessage({ id: `user-${Date.now()}`, role: "user", content: message });
    try {
      useChat.getState().updateStreamingAssistant("");
      const answer = await api.chat({ message, sessionId: sessionId ?? undefined }, (text) =>
        useChat.getState().updateStreamingAssistant(text),
      );
      useChat.getState().finishAssistant(answer.messageId, answer.citations, answer.sessionId);
    } catch (caught) {
      useChat.getState().stopStreaming();
      setError(errorText(te, caught instanceof ApiError ? caught.code : undefined));
    }
  }, [draft, streaming, sessionId, te]);

  const openCitation = async (citation: Citation) => {
    const doc = await api.getDocument(citation.documentId);
    if (!doc) {
      setError(te("DOCUMENT_NOT_FOUND"));
      return;
    }
    setDoc({ docId: doc.id, name: doc.filename, mime: doc.mime, size: doc.sizeBytes });
    router.push(`/${locale}/review`);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet">
      <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-rule bg-band px-3.5">
        <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule">
          {t("title")}
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="font-mono text-[11.5px] text-text-2">{t("empty")}</p>
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              <p
                key={message.id}
                className="ml-auto max-w-[85%] rounded-[3px] border border-rule-soft/70 bg-band/60 px-3 py-1.5 font-mono text-[12px] text-text"
              >
                {message.content}
              </p>
            ) : (
              <div
                key={message.id}
                className="max-w-[90%] rounded-[3px] border border-rule bg-sheet px-3 py-1.5"
              >
                <p className="whitespace-pre-wrap font-mono text-[12px] leading-[1.6] text-text">
                  {message.content}
                </p>
                {message.citations && message.citations.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.citations.map((citation, index) => (
                      <button
                        key={`${message.id}-c-${index}`}
                        type="button"
                        onClick={() => openCitation(citation)}
                        className="rounded-[2px] border border-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent transition hover:bg-accent-soft"
                      >
                        {citation.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )
        )}
        {streaming ? (
          <p className="font-mono text-[11px] text-text-3" aria-live="polite">
            {t("writing")}
            <span className="stream-cursor">▍</span>
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="font-mono text-[11.5px] font-bold text-accent">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-end gap-2 border-t border-rule bg-band/60 px-3 py-2.5">
        <textarea
          rows={2}
          value={draft}
          disabled={streaming}
          placeholder={t("placeholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          className="min-h-[38px] flex-1 resize-none rounded-[3px] border border-rule-soft bg-transparent px-2 py-1.5 font-mono text-[12px] text-text outline-none transition focus:border-rule disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={streaming || draft.trim().length === 0}
          aria-label={t("action")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border border-accent bg-accent-soft text-accent transition hover:bg-accent hover:text-sheet disabled:opacity-50"
        >
          <SendHorizonal size={15} strokeWidth={1.8} />
        </button>
      </div>
    </section>
  );
}
