CREATE TYPE "public"."job_status" AS ENUM('draft', 'scheduled', 'assigned', 'traveling', 'arrived', 'in_progress', 'paused', 'completed', 'incomplete', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."custom_field_entity_type" ADD VALUE 'job';--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "jobs_job_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"customer_id" uuid NOT NULL,
	"site_id" uuid,
	"assigned_to_user_id" uuid,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"job_type" text,
	"description" text,
	"reference" text,
	"scheduled_date" date,
	"scheduled_time" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_jobNumber_unique" UNIQUE("job_number")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;