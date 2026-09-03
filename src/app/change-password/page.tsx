import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            An admin or manager reset your password. Choose a new one to
            continue.
          </p>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
