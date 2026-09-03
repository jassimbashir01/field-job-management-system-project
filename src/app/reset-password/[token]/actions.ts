"use server";

import * as z from "zod";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export interface ResetState {
  status: "idle" | "success" | "error";
  message: string | null;
}

export async function useResetTokenAction(
  token: string,
  _prevState: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = schema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid password",
    };
  }

  const succeeded = await consumePasswordResetToken(
    token,
    parsed.data.password,
  );
  if (!succeeded) {
    return {
      status: "error",
      message:
        "This link is invalid or has expired. Ask whoever sent it to generate a new one.",
    };
  }

  return { status: "success", message: null };
}
