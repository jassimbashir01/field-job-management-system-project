import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

export default async function ForbiddenPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const isTeamMember = user.role === "team_member";
  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      {" "}
      <div className="max-w-sm text-center">
        {" "}
        <h1 className="text-lg font-semibold">
          You don&apos;t have access
        </h1>{" "}
        <p className="mt-2 text-sm text-muted-foreground">
          {" "}
          {isTeamMember
            ? "This part of the app is for Admins and Managers. Your account only has access through the mobile app."
            : "Your account doesn't have permission to view this page. If you think this is a mistake, contact your Admin."}{" "}
        </p>{" "}
        <Button
          render={
            <Link href={isTeamMember ? "/mobile" : "/dashboard"}>
              {" "}
              {isTeamMember ? "Go to your app" : "Back to dashboard"}{" "}
            </Link>
          }
          nativeButton={false}
          className="mt-6"
        />{" "}
      </div>{" "}
    </main>
  );
}
