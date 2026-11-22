import { requireUserOrThrow } from "@/lib/auth/guards";
import { getUserAccessLevels } from "@/lib/auth/permissions";
import { ForbiddenError, toSafeError } from "@/lib/errors";
import { AppError } from "@/lib/errors/app-error";
import { getLiveStamps } from "@/lib/live-stamps";
import { getNotificationSnapshot } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewer = await requireUserOrThrow();
    if (viewer.role !== "admin" && viewer.role !== "manager")
      throw new ForbiddenError();

    if (new URL(request.url).searchParams.get("scope") === "notifications") {
      const notifications = await getNotificationSnapshot(viewer.id);
      return Response.json(
        { notifications },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const levels = await getUserAccessLevels(viewer);
    const readable = new Set(
      Object.entries(levels)
        .filter(([, level]) => level !== "none")
        .map(([key]) => key),
    );

    const [stamps, notifications] = await Promise.all([
      getLiveStamps(readable),
      getNotificationSnapshot(viewer.id),
    ]);
    return Response.json(
      { stamps, notifications },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof AppError ? error.httpStatus : 500;
    return Response.json(
      { error: toSafeError(error) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
