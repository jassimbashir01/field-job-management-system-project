import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";

export default async function MobilePlaceholderPage() {
  const user = await requireUser();

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">
          Hi {user.displayName.split(" ")[0]}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your mobile app isn&apos;t built yet — check back soon.
        </p>
      </div>
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
