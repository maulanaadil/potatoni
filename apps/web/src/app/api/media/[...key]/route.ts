import { NoSuchKey } from "@aws-sdk/client-s3";
import { getObject } from "@/lib/s3";

type Ctx = { params: Promise<{ key: string[] }> };

// Streams bucket objects so the bucket itself can stay private.
export async function GET(_request: Request, { params }: Ctx) {
  const { key: parts } = await params;
  if (parts.some((p) => p === ".." || p === "")) return new Response("Bad key", { status: 400 });

  try {
    const object = await getObject(parts.join("/"));
    if (!object.Body) return new Response("Not found", { status: 404 });
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        "Content-Type": object.ContentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        ...(object.ETag ? { ETag: object.ETag } : {}),
      },
    });
  } catch (err) {
    if (err instanceof NoSuchKey) return new Response("Not found", { status: 404 });
    console.error(err);
    return new Response("Could not load image", { status: 502 });
  }
}
