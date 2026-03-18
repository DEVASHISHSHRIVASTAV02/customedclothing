import { NextRequest } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import { ensureStorageDirs, saveBufferToStorage } from "@/lib/storage";
import { fail, ok } from "@/lib/http";
import { getCustomerSession } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const customerSession = await getCustomerSession();
  const { id } = await context.params;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await checkRateLimit(`upload:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return fail("Upload rate limit exceeded. Please wait and try again.", 429);
  }

  const draft = await prisma.designDraft.findUnique({ where: { id } });
  if (!draft) {
    return fail("Draft not found.", 404);
  }

  if (draft.customerId && draft.customerId !== customerSession?.user.id) {
    return fail("You do not have access to this draft.", 403);
  }

  const formData = await request.formData();
  const rawFile = formData.get("file");
  if (!(rawFile instanceof File)) {
    return fail("File is required.", 400);
  }

  if (rawFile.size > MAX_UPLOAD_BYTES) {
    return fail("File exceeds 10MB limit.", 413);
  }

  const buffer = Buffer.from(await rawFile.arrayBuffer());
  const fileType = await fileTypeFromBuffer(buffer);
  const mimeType = fileType?.mime ?? rawFile.type;

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return fail("Unsupported image type. Use JPG, PNG, or WebP.", 415);
  }

  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    return fail("Unable to read image metadata.", 400);
  }

  await ensureStorageDirs();
  const stored = await saveBufferToStorage({
    kind: "saved-drafts",
    buffer,
    filename: rawFile.name || `upload.${fileType?.ext ?? "png"}`,
    subdirectory: `${id}/uploads`,
  });

  const asset = await prisma.uploadedAsset.create({
    data: {
      draftId: id,
      filePath: stored.relativePath,
      mimeType,
      width: metadata.width,
      height: metadata.height,
      sizeBytes: buffer.byteLength,
    },
  });

  return ok({
    asset: {
      id: asset.id,
      mimeType,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      url: stored.publicUrl,
      relativePath: stored.relativePath,
    },
  });
}
