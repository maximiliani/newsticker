export interface MediaItem {
  local_media_url?: string | null;
  media_url: string;
  local_thumbnail_url?: string | null;
  thumbnail_url?: string | null;
  download_status?: string;
}

/**
 * Get the preferred media URL (local storage first, Meta URL as fallback)
 */
export function getPreferredMediaUrl(media: MediaItem): string {
  // Prioritize local storage URL if available and download was completed
  if (media.local_media_url && media.download_status === 'completed') {
    return media.local_media_url;
  }
  
  // Fallback to Meta URL
  return media.media_url;
}

/**
 * Get the preferred thumbnail URL (local storage first, Meta URL as fallback)
 */
export function getPreferredThumbnailUrl(media: MediaItem): string | null {
  // Prioritize local thumbnail if available
  if (media.local_thumbnail_url) {
    return media.local_thumbnail_url;
  }
  
  // Fallback to Meta thumbnail URL
  return media.thumbnail_url || null;
}

/**
 * Check if media has been successfully downloaded to local storage
 */
export function isMediaLocallyAvailable(media: MediaItem): boolean {
  return !!(media.local_media_url && media.download_status === 'completed');
}

/**
 * Get media loading strategy (for progressive loading)
 */
export function getMediaLoadingStrategy(media: MediaItem): {
  primaryUrl: string;
  fallbackUrl?: string;
  isLocal: boolean;
} {
  const isLocal = isMediaLocallyAvailable(media);
  
  return {
    primaryUrl: getPreferredMediaUrl(media),
    fallbackUrl: isLocal ? media.media_url : undefined,
    isLocal,
  };
}