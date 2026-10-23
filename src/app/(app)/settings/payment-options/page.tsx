import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentOptions } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { ForbiddenMessage } from "@/components/shared/forbidden-message";
import { PaymentOptionsManager } from "./payment-options-manager";

export const dynamic = "force-dynamic";

export default async function PaymentOptionsPage() {
  const viewer = await requireUser();
  if (viewer.role !== "admin") {
    return <ForbiddenMessage />;
  }

  const db = getDb();
  const options = await db
    .select()
    .from(paymentOptions)
    .orderBy(asc(paymentOptions.sortOrder), asc(paymentOptions.createdAt));

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Payment options</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        The ways customers can pay you. When you create an invoice you choose
        which of these to show on it. This app never takes payment itself —
        customers pay you directly, then tell you they have.
      </p>
      <PaymentOptionsManager options={options} />
    </div>
  );
}
