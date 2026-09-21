import { requireUser } from "@/lib/auth/guards";
import { getFieldDefinitions } from "@/lib/custom-fields";
import { getJobTemplatesWithDetails } from "@/lib/job-templates";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { JobTemplatesManager } from "./job-templates-manager";

export const dynamic = "force-dynamic";

export default async function JobTemplatesSettingsPage() {
  const viewer = await requireUser();
  if (viewer.role !== "admin") {
    return <ForbiddenMessage />;
  }

  const [templates, definitions] = await Promise.all([
    getJobTemplatesWithDetails(),
    getFieldDefinitions("job"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Job templates</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Reusable defaults for common job types — a starting checklist and
        default field values, applied when someone picks a template while
        creating a job.
      </p>
      <JobTemplatesManager templates={templates} definitions={definitions} />
    </div>
  );
}
