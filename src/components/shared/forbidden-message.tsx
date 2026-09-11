export function ForbiddenMessage({
  message = "Your account doesn't have permission to view this page. If you think this is a mistake, contact your Admin.",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">You don&apos;t have access</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
