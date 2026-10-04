import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import type { ChatMessage, ChatRequest, Citation, LLMProvider } from "@documind/shared";
import { DRIZZLE_DB } from "../database/database.module";
import type { DrizzleDB } from "../database/drizzle";
import { dbSchema } from "../database/drizzle";
import { PROVIDER } from "../extractions/provider";
import { SearchService } from "../search/search.service";
import { buildContext, extractCitations } from "./citations";

const CHAT_SYSTEM_PROMPT = [
  "Eres DocuMind. Responde SOLO con los fragmentos numerados que se te dan entre <contexto>…</contexto>.",
  "Cita cada dato con su número, p. ej. [2]. Si la respuesta no está en los fragmentos, di exactamente:",
  '"No lo encuentro en tus documentos." No inventes nada. Responde en el idioma del usuario.',
].join("\n");

const HISTORY_WINDOW = 8;

export type ChatAnswer = {
  sessionId: string;
  messageId: string;
  citations: Citation[];
};

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(SearchService) private readonly searchService: SearchService,
    @Inject(PROVIDER) private readonly provider: LLMProvider,
  ) {}

  async chat(req: ChatRequest, onDelta: (text: string) => void): Promise<ChatAnswer> {
    const sessionId = req.sessionId ?? randomUUID();

    const [userRow] = await this.db
      .insert(dbSchema.chatMessages)
      .values({ sessionId, role: "user", content: req.message })
      .returning({ id: dbSchema.chatMessages.id });

    const { items: hits } = await this.searchService.search({
      query: req.message,
      limit: 6,
    });

    const historyRows = await this.db
      .select()
      .from(dbSchema.chatMessages)
      .where(
        and(
          eq(dbSchema.chatMessages.sessionId, sessionId),
          ne(dbSchema.chatMessages.id, userRow!.id),
        ),
      )
      .orderBy(asc(dbSchema.chatMessages.createdAt));
    const history: ChatMessage[] = historyRows
      .slice(-HISTORY_WINDOW)
      .map((row) => ({ role: row.role, content: row.content }));

    const messages: ChatMessage[] = [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      ...history,
      {
        role: "user",
        content: `Pregunta: ${req.message}\n<contexto>\n${buildContext(hits)}\n</contexto>`,
      },
    ];

    let answer = "";
    for await (const chunk of this.provider.chatStream(messages)) {
      if (!chunk.contentDelta) continue;
      answer += chunk.contentDelta;
      onDelta(chunk.contentDelta);
    }

    const citations = extractCitations(answer, hits);
    const [assistantRow] = await this.db
      .insert(dbSchema.chatMessages)
      .values({ sessionId, role: "assistant", content: answer, citations })
      .returning({ id: dbSchema.chatMessages.id });

    return { sessionId, messageId: assistantRow!.id, citations };
  }
}
