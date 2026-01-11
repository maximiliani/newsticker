/**
 * Shared streaming and validation helpers for downloading remote media and
 * uploading to Supabase Storage. Keeps route handlers concise and consistent.
 */

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "video/mp4",
  "video/quicktime",
]);

/**
 * Streams a Response body into a single Uint8Array buffer with size enforcement.
 * Throws if the stream exceeds MAX_FILE_SIZE.
 */
export async function streamDownloadToBuffer(res: Response): Promise<{ buffer: Uint8Array; size: number }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Failed to initialize stream reader");

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    size += value.length;
    if (size > MAX_FILE_SIZE) {
      try { reader.cancel(); } catch {}
      throw new Error(`File too large: ${size} bytes`);
    }
  }

  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return { buffer, size };
}

/**
 * Derive a common file extension based on content-type.
 */
export function extFromContentType(ct: string): string {
  const lower = ct.toLowerCase();
  if (lower.includes("jpeg")) return ".jpg";
  if (lower.includes("png")) return ".png";
  if (lower.includes("gif")) return ".gif";
  if (lower.includes("mp4")) return ".mp4";
  if (lower.includes("quicktime")) return ".mov";
  return "";
}
