export async function register() {
  await import("@/lib/env");

  const { assertStorageConfigured } =
    await import("@/lib/storage/assert-configured");
  assertStorageConfigured();
}
