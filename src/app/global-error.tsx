"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-dvh items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-gray-500">
              Please try again. If this keeps happening, contact support
              {error.digest && ` and mention error ID ${error.digest}`}.
            </p>
            <button
              onClick={reset}
              className="mt-6 rounded-md bg-black px-3 py-2 text-sm text-white"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
