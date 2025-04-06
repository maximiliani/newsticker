import Image from "next/image";
interface MediaDisplayProps {
  src: string;
  alt?: string;
  type: "image" | "video";
  className?: string;
  aspectRatio?: "square" | "video" | "wide";
  onError?: () => void;
}

export function MediaDisplay({
  src,
  alt = "",
  type,
  className = "",
  aspectRatio = "square",
  onError,
}: MediaDisplayProps) {
  // Define aspect ratio classes
  const aspectRatioClasses = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[16/9]",
  };

  // Base classes for both image and video
  const baseClasses = `w-full object-cover ${aspectRatioClasses[aspectRatio]} ${className}`;

  // Handle media load error
  const handleError = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
    console.error("Error loading media:", e);
    onError?.();
  };

  if (type === "video") {
    return (
      <video
        src={src}
        className={baseClasses}
        controls
        onError={handleError}
        playsInline
        autoPlay
        muted
        loop
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      onError={handleError}
      loading="lazy"
      width={500}
      height={300}
      className={baseClasses}
    />
  );
} 