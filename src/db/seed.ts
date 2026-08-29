import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import * as z from "zod";
import { getDb } from "./index";
import { companies, users } from "./schema";
import { hashPassword } from "../lib/auth/password";

const adminSchema = z.object({
  companyName: z.string().min(1),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1),
});

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("Field Job Management System — first-run setup\n");
  console.log(
    "This creates the one company record and the first Admin account. " +
      "Run this once, right after your first migration.\n",
  );

  const companyName = await rl.question("Company name: ");
  const displayName = await rl.question("Your name: ");
  const email = await rl.question("Admin email: ");
  const password = await rl.question(
    "Admin password (min 8 characters — this is a local terminal " +
      "prompt, not masked, so make sure nobody's reading over your " +
      "shoulder): ",
  );

  rl.close();

  const parsed = adminSchema.safeParse({
    companyName,
    email,
    password,
    displayName,
  });

  if (!parsed.success) {
    console.error("\nSomething entered above wasn't valid:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  const db = getDb();

  const existingCompanies = await db.select().from(companies).limit(1);
  if (existingCompanies.length > 0) {
    console.error(
      "\nA company record already exists — this script only runs once, " +
        "on a fresh database. Refusing to create a second one.",
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db.transaction(async (tx) => {
    await tx.insert(companies).values({ name: parsed.data.companyName });
    await tx.insert(users).values({
      email: parsed.data.email,
      passwordHash,
      role: "admin",
      displayName: parsed.data.displayName,
    });
  });

  console.log(
    `\nDone. "${parsed.data.companyName}" is set up, and ` +
      `${parsed.data.email} can sign in as Admin.`,
  );
}

main().catch((error) => {
  console.error("\nSeed script failed:", error);
  process.exit(1);
});
