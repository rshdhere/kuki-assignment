CREATE TYPE "public"."document_event_type" AS ENUM('upload_started', 'queued', 'duplicate', 'extraction_started', 'extraction_failed', 'extraction_succeeded');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('awaiting_upload', 'queued', 'extracting', 'retrying', 'succeeded', 'failed', 'duplicate');--> statement-breakpoint
CREATE TABLE "document_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"document_id" uuid NOT NULL,
	"type" "document_event_type" NOT NULL,
	"message" text NOT NULL,
	"attempt" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"bucket" text,
	"s3_key" text,
	"status" "document_status" NOT NULL,
	"duplicate_of" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"doc_type" text,
	"organisation" text,
	"period_start" date,
	"period_end" date,
	"page_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_s3_key_unique" UNIQUE("s3_key")
);
--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_duplicate_of_documents_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_events_document_id_idx" ON "document_events" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_events_created_at_idx" ON "document_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "documents_sha256_original_idx" ON "documents" USING btree ("sha256") WHERE "documents"."status" in ('queued', 'extracting', 'retrying', 'succeeded');--> statement-breakpoint
CREATE INDEX "documents_sha256_idx" ON "documents" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at" DESC NULLS LAST);