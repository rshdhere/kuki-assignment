CREATE TYPE "public"."fact_origin" AS ENUM('reported', 'calculated');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"document_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_segments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_segments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"locator" jsonb NOT NULL,
	"text" text NOT NULL,
	"cells" jsonb,
	"scanned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "facts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"document_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"metric" text,
	"series" text,
	"value_text" text NOT NULL,
	"value_number" double precision,
	"unit" text,
	"period_start" date,
	"period_end" date,
	"note" text,
	"origin" "fact_origin" NOT NULL,
	"locator" jsonb NOT NULL,
	"quote" text,
	"verified" boolean NOT NULL,
	"verification" text NOT NULL,
	"derivation" text
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "issuer" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "issues" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "fact_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_segments" ADD CONSTRAINT "document_segments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answers_created_at_idx" ON "answers" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "document_segments_document_id_idx" ON "document_segments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "facts_document_id_idx" ON "facts" USING btree ("document_id");