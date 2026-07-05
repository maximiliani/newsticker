import { useState } from 'react';

import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';

interface MediaDisplayProps {
  type: "image" | "video";
  src: string;
  alt?: string;
  className?: string;
}

export function MediaDisplay({ type, src, alt, className }: MediaDisplayProps) {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
  };

  const handleLoad = () => {
    setHasError(false);
  };

  if (type === "video") {
    return (
      <AspectRatio ratio={1} className={cn('relative overflow-hidden', className)}>
        <video
          src={src}
          controls
          onError={handleError}
          onLoadedData={handleLoad}
          className="h-full w-full object-cover"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <span className="text-gray-500">Failed to load video</span>
          </div>
        )}
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={1} className={cn('relative overflow-hidden', className)}>
      <img
        src={src}
        alt={alt || 'Media content'}
        onError={handleError}
        onLoad={handleLoad}
        className="h-full w-full object-cover"
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      )}
    </AspectRatio>
  );
}

// Enhanced version for Instagram media with fallback support
interface InstagramMedia {
  local_media_url?: string | null;
  media_url: string;
  local_thumbnail_url?: string | null;
  thumbnail_url?: string | null;
  download_status?: string;
}

interface InstagramMediaProps {
  media: InstagramMedia;
  type: "image" | "video";
  alt?: string;
  className?: string;
}

export function InstagramMediaDisplay({ media, type, alt, className }: InstagramMediaProps) {
  const [hasError, setHasError] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

  // Create priority list of URLs to try
  const urlOptions = [
    media.local_media_url && media.download_status === 'completed' ? media.local_media_url : null,
    media.media_url
  ].filter(Boolean) as string[];

  const currentUrl = urlOptions[currentUrlIndex] || media.media_url;

  const handleError = () => {
    // Try next URL option if available
    if (currentUrlIndex < urlOptions.length - 1) {
      setCurrentUrlIndex(currentUrlIndex + 1);
      setHasError(false);
    } else {
      setHasError(true);
    }
  };

  const handleLoad = () => {
    setHasError(false);
  };

  if (type === "video") {
    return (
      <AspectRatio ratio={1} className={cn('relative overflow-hidden', className)}>
        <video
          key={currentUrl} // Force re-render when URL changes
          src={currentUrl}
          controls
          muted
          loop
          onError={handleError}
          onLoadedData={handleLoad}
          className="h-full w-full object-cover"
          // preload="metadata"
          preload="none"
          poster={media.local_thumbnail_url || media.thumbnail_url || undefined}
        >
          Your browser does not support the video tag.
        </video>
        
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <span className="text-gray-500">Failed to load video</span>
          </div>
        )}
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={1} className={cn('relative overflow-hidden', className)}>
      <img
        key={currentUrl} // Force re-render when URL changes
        src={currentUrl}
        alt={alt || 'Instagram media'}
        onError={handleError}
        onLoad={handleLoad}
        className="h-full w-full object-cover"
      />
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      )}
    </AspectRatio>
  );
}