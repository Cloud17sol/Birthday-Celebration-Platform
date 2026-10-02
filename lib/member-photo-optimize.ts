import sharp from "sharp";
import {
  MEMBER_PHOTO_MAX_EDGE,
  MEMBER_PHOTO_STORED_CONTENT_TYPE,
  MEMBER_PHOTO_STORED_MAX_BYTES,
} from "./member-photo";

const startingQuality = 82;
const minimumQuality = 50;
const qualityStep = 8;
const maximumAttempts = 5;

const sharpOptions = {
  failOn: "error" as const,
  animated: false,
  limitInputPixels: 40_000_000,
};

export type OptimizedMemberPhoto =
  | {
      ok: true;
      data: Buffer;
      contentType: typeof MEMBER_PHOTO_STORED_CONTENT_TYPE;
    }
  | {
      ok: false;
      reason: "unreadable" | "too_large";
    };

async function encodeWebp(input: Buffer, quality: number) {
  return sharp(input, sharpOptions)
    .rotate()
    .resize({
      width: MEMBER_PHOTO_MAX_EDGE,
      height: MEMBER_PHOTO_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

export async function optimizeMemberPhoto(
  input: Buffer
): Promise<OptimizedMemberPhoto> {
  let quality = startingQuality;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    let output: Buffer;

    try {
      output = await encodeWebp(input, quality);
    } catch {
      return { ok: false, reason: "unreadable" };
    }

    if (output.length < MEMBER_PHOTO_STORED_MAX_BYTES) {
      return {
        ok: true,
        data: output,
        contentType: MEMBER_PHOTO_STORED_CONTENT_TYPE,
      };
    }

    if (quality <= minimumQuality) {
      break;
    }

    quality = Math.max(minimumQuality, quality - qualityStep);
  }

  return { ok: false, reason: "too_large" };
}
