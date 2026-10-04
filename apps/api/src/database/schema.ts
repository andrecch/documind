import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { DOCUMENT_STATUSES, EXTRACTION_STATUSES, REVISION_ACTIONS } from "@documind/shared";

export const documentStatusEnum = pgEnum("document_status", DOCUMENT_STATUSES);
export const extractionStatusEnum = pgEnum("extraction_status", EXTRACTION_STATUSES);
export const revisionActionEnum = pgEnum("revision_action", REVISION_ACTIONS);
export const docTypeEnum = pgEnum("doc_type", [
  "factura",
  "contrato",
  "recibo",
  "documentacion",
  "propuesta",
]);
export const chunkKindEnum = pgEnum("chunk_kind", ["document", "item"]);
export const modelPurposeEnum = pgEnum("model_purpose", ["vision", "embedding", "chat"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    pageCount: integer("page_count").default(1),
    status: documentStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_documents_status_created").on(table.status, table.createdAt)],
);

export const extractions = pgTable(
  "extractions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    status: extractionStatusEnum("status").notNull().default("draft"),
    docType: docTypeEnum("doc_type").notNull(),
    confidence: real("confidence").notNull(),
    llmData: jsonb("llm_data").notNull(),
    confirmedData: jsonb("confirmed_data"),
    fieldAudit: jsonb("field_audit"),
    provider: text("provider").notNull(),
    modelId: text("model_id").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_extractions_document").on(table.documentId)],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    extractionId: uuid("extraction_id")
      .notNull()
      .references(() => extractions.id, { onDelete: "cascade" }),
    kind: chunkKindEnum("kind").notNull().default("document"),
    itemIndex: integer("item_index"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 2048 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_chunks_document").on(table.documentId)],
);

export const extractionRevisions = pgTable(
  "extraction_revisions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    extractionId: uuid("extraction_id")
      .notNull()
      .references(() => extractions.id, { onDelete: "cascade" }),
    action: revisionActionEnum("action").notNull(),
    actor: text("actor").notNull(),
    llmData: jsonb("llm_data").notNull(),
    confirmedData: jsonb("confirmed_data"),
    fieldAudit: jsonb("field_audit"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_revisions_extraction").on(table.extractionId)],
);

export const modelConfig = pgTable(
  "model_config",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    provider: text("provider").notNull(),
    purpose: modelPurposeEnum("purpose").notNull(),
    modelId: text("model_id").notNull(),
    dimensions: integer("dimensions"),
    isDefault: boolean("is_default").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_model_config_purpose").on(table.purpose, table.isDefault),
    uniqueIndex("uq_model_config_provider_purpose").on(table.provider, table.purpose),
  ],
);

export const providerSettings = pgTable("provider_settings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(),
  apiKeyCipher: text("api_key_cipher").notNull(),
  apiKeyHint: text("api_key_hint").notNull(),
  isDefault: boolean("is_default").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: uuid("session_id").notNull(),
    role: chatRoleEnum("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_chat_messages_session").on(table.sessionId, table.createdAt)],
);
