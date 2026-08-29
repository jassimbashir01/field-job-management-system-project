import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { cache } from "react";
import { env } from "@/lib/env";
import * as schema from "./schema";

const nodePool =
  process.env.DEPLOY_TARGET === "cloudflare"
    ? null
    : new Pool({ connectionString: env.DATABASE_URL });

export const getDb = cache(() => {
  if (process.env.DEPLOY_TARGET === "cloudflare") {
    const { env: cfEnv } = getCloudflareContext();
    const hyperdrive = (cfEnv as { HYPERDRIVE: { connectionString: string } })
      .HYPERDRIVE;
    const pool = new Pool({
      connectionString: hyperdrive.connectionString,
      maxUses: 1,
    });
    return drizzle({ client: pool, schema, casing: "snake_case" });
  }

  return drizzle({ client: nodePool!, schema, casing: "snake_case" });
});
