import { SupabaseClient } from '@supabase/supabase-js';
import { streamDownloadToBuffer } from '@/lib/storage/stream';
import { CalendarAttachment } from '@/types/calendar';
import { isSafeUrl } from '@/lib/security';

/**
 * Downloads calendar event attachments and stores them in Supabase Storage.
 * Handles both data URLs and HTTP/HTTPS URLs.
<<<<<<< ours
 *
=======
 * 
>>>>>>> theirs
 * @returns Array of public URLs for the stored attachments
 */
export async function downloadAndStoreAttachments(
  attachments: CalendarAttachment[],
  subscriptionId: string,
  eventUid: string,
  userId: string,
  admin: SupabaseClient
<<<<<<< ours
): Promise<string[]> {
  const publicUrls: string[] = [];
=======
): Promise<{ url: string; filename: string; path: string }[]> {
  const processedAttachments: { url: string; filename: string; path: string }[] = [];
>>>>>>> theirs

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
<<<<<<< ours
=======

        const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
        if (contentLength > 52_428_800) {
          console.warn(`Skipping oversized attachment (${contentLength} bytes): ${attachment.url}`);
          continue;
        }

>>>>>>> theirs
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
<<<<<<< ours

=======
      
>>>>>>> theirs
      const { error: uploadError } = await admin.storage
        .from('calendar-attachments')
        .upload(filePath, buffer, {
          contentType: contentType || 'application/octet-stream',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Return a relative URL to our authenticated proxy route instead of a public Supabase URL.
      // This ensures that only the owner can access the attachment.
      const proxyUrl = `/api/features/calendar/attachments/${filePath}`;
<<<<<<< ours
      publicUrls.push(proxyUrl);
=======
      processedAttachments.push({ url: proxyUrl, filename: attachment.filename, path: filePath });
>>>>>>> theirs
    } catch (err) {
      console.warn(`Failed to process attachment ${attachment.filename}:`, err);
    }
  }

<<<<<<< ours
  return publicUrls;
}
=======
  return processedAttachments;
}

/**
 * Deletes attachments from Supabase Storage.
 */
export async function deleteAttachments(paths: string[], admin: SupabaseClient): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await admin.storage.from('calendar-attachments').remove(paths);
  if (error) {
    console.error('Failed to cleanup attachments:', error);
  }
}

>>>>>>> theirs
