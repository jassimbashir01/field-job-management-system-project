import { requireUser } from "@/lib/auth/guards";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome, {user.displayName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Job, customer, and schedule summaries will appear here as those features
        are built.
      </p>
    </div>
  );
}
