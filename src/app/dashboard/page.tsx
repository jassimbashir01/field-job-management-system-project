import { requireUser } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Welcome, {user.displayName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in as {user.email} · role: {user.role}
      </p>
      <form action={logoutAction} className="mt-6">
        <button
          type="submit"
          className="rounded-md border border-input px-3 py-2 text-sm"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
