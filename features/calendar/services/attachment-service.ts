import { SupabaseClient } from '@supabase/supabase-js';
import { streamDownloadToBuffer } from '@/lib/storage/stream';
import { CalendarAttachment } from '@/types/calendar';
<<<<<<< ours
=======
import { isSafeUrl } from '@/lib/security';
>>>>>>> theirs

/**
 * Downloads calendar event attachments and stores them in Supabase Storage.
 * Handles both data URLs and HTTP/HTTPS URLs.
 * 
 * @returns Array of public URLs for the stored attachments
 */
export async function downloadAndStoreAttachments(
  attachments: CalendarAttachment[],
  subscriptionId: string,
  eventUid: string,
  userId: string,
  admin: SupabaseClient
): Promise<string[]> {
  const publicUrls: string[] = [];

  // Sanitize eventUid for file path
  const sanitizedEventUid = eventUid.replace(/[^a-zA-Z0-9_-]/g, '_');

  for (const attachment of attachments) {
    try {
      let buffer: Uint8Array;
      let contentType = attachment.mimeType;

      if (attachment.url.startsWith('data:')) {
        const parts = attachment.url.split(',');
        if (parts.length < 2) continue;
        const base64 = parts[1];
        const mimeMatch = parts[0].match(/data:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        contentType = contentType || mime;
        buffer = Buffer.from(base64, 'base64');
      } else if (attachment.url.startsWith('http')) {
        if (!isSafeUrl(attachment.url)) {
          console.warn(`Skipping potentially unsafe attachment URL: ${attachment.url}`);
          continue;
        }
        const response = await fetch(attachment.url);
        if (!response.ok) {
          console.warn(`Failed to fetch attachment ${attachment.url}: ${response.statusText}`);
          continue;
        }
        contentType = contentType || response.headers.get('Content-Type') || 'application/octet-stream';
        const res = await streamDownloadToBuffer(response);
        buffer = res.buffer;
      } else {
        console.warn(`Skipping unsupported attachment URL scheme: ${attachment.url.substring(0, 10)}...`);
        continue;
      }

      // Sanitize filename
      const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `${userId}/${subscriptionId}/${sanitizedEventUid}/${sanitizedFilename}`;
      
      const { error: uploadError } = await admin.storage
        .from('calendar-attachments')
        .upload(filePath, buffer, {
          contentType: contentType || 'application/octet-stream',
          upsert: true
        });

      if (uploadError) throw uploadError;

<<<<<<< ours
      const { data } = admin.storage
        .from('calendar-attachments')
        .getPublicUrl(filePath);

      publicUrls.push(data.publicUrl);
=======
      // Return a relative URL to our authenticated proxy route instead of a public Supabase URL.
      // This ensures that only the owner can access the attachment.
      const proxyUrl = `/api/features/calendar/attachments/${filePath}`;
      publicUrls.push(proxyUrl);
>>>>>>> theirs
    } catch (err) {
      console.warn(`Failed to process attachment ${attachment.filename}:`, err);
    }
  }

  return publicUrls;
}

<<<<<<< ours
/**
 * Validates that a URL is safe to fetch, preventing SSRF attacks.
 * Blocks non-HTTP/HTTPS protocols and private IP ranges.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;

    // Check for private IP ranges (IPv4)
    const privateIPRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/;
    if (privateIPRegex.test(hostname)) return false;

    // IPv6 private/link-local ranges
    if (hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) return false;

    return true;
  } catch {
    return false;
  }
}
=======
>>>>>>> theirs
