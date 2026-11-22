import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.role === "team_member" ? "/mobile" : "/dashboard");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Forgot your password?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to choose a new one.
          </p>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
