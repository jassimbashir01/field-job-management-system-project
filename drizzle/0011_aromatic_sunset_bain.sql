CREATE TYPE "public"."recurrence_interval_unit" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TABLE "job_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid,
	"one_off_location" text,
	"assigned_to_user_id" uuid,
	"title" text NOT NULL,
	"job_type" text,
	"description" text,
	"reference" text,
	"scheduled_time" text,
	"interval_unit" "recurrence_interval_unit" NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"last_generated_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "follow_up_from_job_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "recurrence_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "occurrence_date" date;--> statement-breakpoint
ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_follow_up_from_job_id_jobs_id_fk" FOREIGN KEY ("follow_up_from_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_recurrence_id_job_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."job_recurrences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_recurrenceId_occurrenceDate_unique" UNIQUE("recurrence_id","occurrence_date");