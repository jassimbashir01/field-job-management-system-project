import { getPublicStamp } from "@/lib/live-stamps";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return Response.json({ stamp: null }, { status: 404 });
  }
  try {
    const stamp = await getPublicStamp("invoice", token);
    return Response.json(
      { stamp },
      { status: stamp ? 200 : 404, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ stamp: null }, { status: 500 });
  }
}
