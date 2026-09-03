import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isPasswordResetTokenValid } from "@/lib/auth/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await isPasswordResetTokenValid(token);

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {valid ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This link has already been used or has expired. Ask whoever sent
              it to generate a new one.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
