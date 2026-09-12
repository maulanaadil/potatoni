import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, HttpError, requireApiSession } from "@/lib/api";
import { mediaUrl } from "@/lib/format";
import { putObject } from "@/lib/s3";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

// multipart/form-data: file=<image>, folder=menu|seasoning|addon
export const POST = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const form = await request.formData().catch(() => {
    throw new HttpError(400, "Expected a multipart form upload");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose an image to upload");

  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(400, "Only PNG, JPG or WEBP images are allowed");
  if (file.size > MAX_BYTES) throw new HttpError(400, "Images must be 5 MB or smaller");

  const folder = String(form.get("folder") ?? "uploads").replace(/[^a-z-]/g, "") || "uploads";
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);

  await logActivity({
    action: "media.uploaded",
    message: `${session.name} uploaded an image to ${folder}`,
    source: "DASHBOARD",
    session,
    meta: { key },
  });
  return NextResponse.json({ key, url: mediaUrl(key) }, { status: 201 });
});
