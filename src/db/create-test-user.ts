import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import * as z from "zod";
import { getDb } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/auth/password";

const schema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1),
  role: z.enum(["manager", "team_member"]),
});

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("Create a test Manager or Team Member.\n");
  console.log(
    "Temporary — Phase 7 builds the real Users & Team UI for this. " +
      "Use it to create accounts for testing role-based access, then " +
      "delete them once Phase 7 lands.\n",
  );

  const email = await rl.question("Email: ");
  const password = await rl.question(
    "Password (min 8 characters, not masked): ",
  );
  const displayName = await rl.question("Display name: ");
  const role = await rl.question("Role (manager / team_member): ");

  rl.close();

  const parsed = schema.safeParse({ email, password, displayName, role });
  if (!parsed.success) {
    console.error("\nSomething entered above wasn't valid:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  const db = getDb();
  const passwordHash = await hashPassword(parsed.data.password);

  await db.insert(users).values({
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
    displayName: parsed.data.displayName,
  });

  console.log(`\nCreated ${parsed.data.role}: ${parsed.data.email}`);
}

main().catch((error) => {
  console.error("\nFailed:", error);
  process.exit(1);
});
