import { MediaDisplay } from "@/components/media-display";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

export interface IGPostData {
  id: string;
  username: string;
  userAvatar: string;
  location?: string;
  media: {
    type: "image" | "video";
    url: string;
  }[];
  caption?: string;
  postedAt: Date;
}

export function IGPost({ post }: { post: IGPostData }) {
  return (
    <div className="bg-card rounded-lg overflow-hidden shadow-sm border">
      {/* Post Header */}
      <div className="p-2 flex items-center space-x-2">
        <img
          src={post.userAvatar}
          alt={post.username}
          className="w-6 h-6 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-xs truncate">{post.username}</p>
          {post.location && (
            <p className="text-xs text-muted-foreground truncate">{post.location}</p>
          )}
        </div>
      </div>

      {/* Post Image */}
      {post.media.length === 1 ? (
        <MediaDisplay
          key={post.media[0].url}
          type={post.media[0].type} 
          src={post.media[0].url}
          className="w-full aspect-square object-cover"
        />
      ) : (
        <div className="w-full aspect-square">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            plugins={[
              Autoplay({
                delay: 5000,
                stopOnInteraction: true,
                stopOnMouseEnter: true,
              }),
            ]}
            className="w-full"
          >
            <CarouselContent>
              {post.media.map((media, index) => (
                <CarouselItem key={media.url} className="w-full">
                  <MediaDisplay
                    type={media.type}
                    src={media.url}
                    className="w-full aspect-square object-cover"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>
        </div>
      )}

      {/* Caption and Date */}
      <div className="p-2 space-y-1">
        <p className="text-xs">
          <span className="font-semibold mr-1">{post.username}</span>
          {post.caption}
        </p>
        <p className="text-[10px] text-muted-foreground uppercase">
          {post.postedAt.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
} 