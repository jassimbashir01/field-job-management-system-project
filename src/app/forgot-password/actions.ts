"use server";

import { sql } from "drizzle-orm";
import { after } from "next/server";
import * as z from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  RESET_TOKEN_DURATION_MS,
  createPasswordResetToken,
  hasRecentResetRequest,
} from "@/lib/auth/password-reset";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { loadBranding } from "@/lib/pdf/load-document";
import { renderPasswordResetEmail } from "@/lib/password-reset-email";

const schema = z.object({ email: z.email("Enter a valid email address.") });

export interface ForgotState {
  status: "idle" | "sent" | "error";
  message: string | null;
}

const SENT_MESSAGE =
  "If an account exists for that email, a reset link is on its way. It works for one hour.";

export async function requestPasswordResetAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Enter a valid email.",
    };
  }
  const email = parsed.data.email.trim().toLowerCase();

  if (!isEmailConfigured()) {
    return {
      status: "error",
      message:
        "Email isn't set up on this server, so reset links can't be sent. Ask an administrator to reset your password.",
    };
  }

  after(async () => {
    try {
      const [user] = await getDb()
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          isActive: users.isActive,
        })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);

      if (!user || !user.isActive) return;
      if (await hasRecentResetRequest(user.id)) return;

      const rawToken = await createPasswordResetToken(user.id);
      const link = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${rawToken}`;
      const { branding } = await loadBranding();
      const message = renderPasswordResetEmail({
        displayName: user.displayName,
        link,
        validMinutes: RESET_TOKEN_DURATION_MS / 60_000,
        branding,
      });
      await sendEmail({ to: user.email, ...message });
    } catch (error) {
      logger.error("Password reset email failed", {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      });
    }
  });

  return { status: "sent", message: SENT_MESSAGE };
}
