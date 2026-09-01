"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { toSafeError, type SafeError } from "@/lib/errors";

const settingsSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  logoUrl: z.union([z.url(), z.literal("")]).optional(),
  primaryColor: z.string().optional(),
  contactEmail: z.union([z.email(), z.literal("")]).optional(),
  contactPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Not a valid timezone"),
  defaultTeamMemberLabel: z.string().min(1),
});

export interface SettingsState {
  success: boolean;
  error: SafeError | null;
}

export async function updateSettingsAction(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireRole("admin");

    const parsed = settingsSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
      };
    }

    const db = getDb();
    const existing = await db
      .select({ id: companies.id })
      .from(companies)
      .limit(1);
    const existingRow = existing[0];
    if (!existingRow) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "No company record exists yet." },
      };
    }

    await db
      .update(companies)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(companies.id, existingRow.id));

    revalidatePath("/settings");

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
