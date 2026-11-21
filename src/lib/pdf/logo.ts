import { safeHttpsUrl } from "@/lib/branding-utils";

const MAX_LOGO_BYTES = 1_000_000;
const TIMEOUT_MS = 4000;

export interface FetchedLogo {
  kind: "png" | "jpg";
  bytes: Uint8Array;
}

function isForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return false;
}

export async function fetchLogo(logoUrl: string): Promise<FetchedLogo | null> {
  const safe = safeHttpsUrl(logoUrl);
  if (!safe) return null;
  const url = new URL(safe);
  if (isForbiddenHost(url.hostname)) return null;

  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "image/png,image/jpeg" },
    });
    if (!response.ok) return null;
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_LOGO_BYTES) return null;

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_LOGO_BYTES)
      return null;

    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { kind: "png", bytes: buffer };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { kind: "jpg", bytes: buffer };
    }
    return null;
  } catch {
    return null;
  }
}
