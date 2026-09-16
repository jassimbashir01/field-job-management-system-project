import { requireUser } from "@/lib/auth/guards";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { NewUserForm } from "./new-user-form";

export default async function NewTeamMemberPage() {
  const viewer = await requireUser();
  if (viewer.role !== "admin") {
    return <ForbiddenMessage />;
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">Add a team member</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        They&apos;ll be asked to set their own password the first time they sign
        in.
      </p>
      <NewUserForm />
    </div>
  );
}
