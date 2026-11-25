CREATE TYPE "public"."punch_location_status" AS ENUM('not_requested', 'captured', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."punch_source" AS ENUM('self', 'manager');--> statement-breakpoint
CREATE TABLE "punches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"punched_in_at" timestamp with time zone NOT NULL,
	"punched_out_at" timestamp with time zone,
	"in_location_status" "punch_location_status" DEFAULT 'not_requested' NOT NULL,
	"in_latitude" double precision,
	"in_longitude" double precision,
	"in_accuracy_meters" double precision,
	"out_location_status" "punch_location_status" DEFAULT 'not_requested' NOT NULL,
	"out_latitude" double precision,
	"out_longitude" double precision,
	"out_accuracy_meters" double precision,
	"source" "punch_source" DEFAULT 'self' NOT NULL,
	"edited_at" timestamp with time zone,
	"edited_by_user_id" uuid,
	"edit_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "punch_location_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "punches" ADD CONSTRAINT "punches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punches" ADD CONSTRAINT "punches_edited_by_user_id_users_id_fk" FOREIGN KEY ("edited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "punches_user_id_punched_in_at_index" ON "punches" USING btree ("user_id","punched_in_at");--> statement-breakpoint
CREATE INDEX "punches_punched_in_at_index" ON "punches" USING btree ("punched_in_at");--> statement-breakpoint
CREATE UNIQUE INDEX "punches_one_open_per_user" ON "punches" USING btree ("user_id") WHERE "punches"."punched_out_at" is null;