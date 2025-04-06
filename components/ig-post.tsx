import { MediaDisplay } from "@/components/media-display";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { formatDate } from "@/utils/utils";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
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
    <div className="bg-card rounded-lg overflow-hidden shadow-sm border h-96 w-64 flex-none flex flex-col">
      {/* Post Header */}
      <div className="p-2 flex items-center space-x-2 h-10 flex-none">
        <Image
          src={post.userAvatar}
          alt={post.username}
          className="w-6 h-6 rounded-full object-cover"
          width={24}
          height={24} 
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-xs truncate">{post.username}</p>
          {post.location && (
            <p className="text-xs text-muted-foreground truncate">{post.location}</p>
          )}
        </div>
      </div>

      {/* Post Image */}
      <div className="w-full aspect-square flex-none">
        {post.media.length === 1 ? (
          <MediaDisplay
            type={post.media[0].type} 
            src={post.media[0].url}
            className="w-full h-full object-cover"
          />
        ) : (
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
            className="w-full h-full"
          >
            <CarouselContent>
              {post.media.map((media, index) => (
                <CarouselItem key={media.url} className="w-full">
                  <MediaDisplay
                    type={media.type}
                    src={media.url}
                    className="w-full h-full object-cover"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>
        )}
      </div>

      {/* Caption and Date */}
      <div className="p-2 text-xs flex flex-col h-28 flex-none">
        <div className="flex-1 overflow-y-auto hover:overflow-y-scroll line-clamp-3 group-hover:line-clamp-none max-h-12">
          <span className="font-semibold">{post.username}</span> {post.caption}
        </div>
        <time className="text-muted-foreground text-xs flex-none uppercase mt-2 bottom-0">
          {formatDate(post.postedAt)}
        </time>
      </div>
    </div>
  );
} 