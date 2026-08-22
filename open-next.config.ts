import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache override. Every route in this application is
// authenticated and dynamic — there's no ISR/SSG output to cache, and an R2
// cache binding would be dead weight. Revisit only if a public marketing
// page is ever added.
export default defineCloudflareConfig();
