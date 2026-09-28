CREATE TYPE "public"."chunk_kind" AS ENUM('document', 'item');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('factura', 'contrato', 'recibo', 'documentacion', 'propuesta');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'processing', 'ready_for_review', 'archivado', 'error');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('draft', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."model_purpose" AS ENUM('vision', 'embedding', 'chat');--> statement-breakpoint
CREATE TYPE "public"."revision_action" AS ENUM('created', 'draft_edit', 'confirmed', 'post_confirm_edit');--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"extraction_id" uuid NOT NULL,
	"kind" "chunk_kind" DEFAULT 'document' NOT NULL,
	"item_index" integer,
	"content" text NOT NULL,
	"embedding" vector(2048) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"page_count" integer DEFAULT 1,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_id" uuid NOT NULL,
	"action" "revision_action" NOT NULL,
	"actor" text NOT NULL,
	"llm_data" jsonb NOT NULL,
	"confirmed_data" jsonb,
	"field_audit" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "extraction_status" DEFAULT 'draft' NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"confidence" real NOT NULL,
	"llm_data" jsonb NOT NULL,
	"confirmed_data" jsonb,
	"field_audit" jsonb,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"purpose" "model_purpose" NOT NULL,
	"model_id" text NOT NULL,
	"dimensions" integer,
	"is_default" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"api_key_cipher" text NOT NULL,
	"api_key_hint" text NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_extraction_id_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."extractions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_revisions" ADD CONSTRAINT "extraction_revisions_extraction_id_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."extractions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chunks_document" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_documents_status_created" ON "documents" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_revisions_extraction" ON "extraction_revisions" USING btree ("extraction_id");--> statement-breakpoint
CREATE INDEX "idx_extractions_document" ON "extractions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_model_config_purpose" ON "model_config" USING btree ("purpose","is_default");

CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops);
