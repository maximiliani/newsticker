import {InstagramMediaDisplay} from "@/components/media-display";
import {Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,} from "@/components/ui/carousel";
import {formatDate} from "@/utils/utils";
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
        // Add the properties that InstagramMediaDisplay expects
        media_url: string;
        thumbnail_url?: string | null;
        local_media_url?: string | null;
        local_thumbnail_url?: string | null;
        download_status?: string;
    }[];
    caption?: string;
    postedAt: Date;
}

export function IGPost({post}: {post: IGPostData}) {
    return (
        <div className="bg-card rounded-lg overflow-hidden shadow-sm border w-full h-full flex flex-col min-w-0">
            {/* Post Header */}
            <div className="p-2 flex items-center gap-2 h-10 flex-none border-b">
                <Image
                    src={post.userAvatar}
                    alt={post.username}
                    className="size-6 rounded-full object-cover"
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

            {/* Post Media Content */}
            <div className="w-full flex-1 overflow-hidden relative min-w-0">
                {post.media.length === 1 ? (
                    <InstagramMediaDisplay
                        media={post.media[0]}
                        type={post.media[0].type}
                    />
                ) : (
                    <Carousel
                        className="w-full h-full"
                        plugins={[Autoplay({delay: 5000, stopOnInteraction: true})]}
                    >
                        <CarouselContent className="h-full">
                            {post.media.map((mediaItem, index) => (
                                <CarouselItem key={index} className="h-full">
                                    <InstagramMediaDisplay
                                        media={mediaItem}
                                        type={mediaItem.type}
                                    />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        {post.media.length > 1 && (
                            <>
                                <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10"/>
                                <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10"/>
                            </>
                        )}
                    </Carousel>
                )}
            </div>

            {/* Caption and Date */}
            <div className="p-2 text-xs flex flex-col h-28 flex-none">
                <div
                    className="flex-1 overflow-y-auto hover:overflow-y-scroll line-clamp-5 group-hover:line-clamp-none">
                    <span className="font-semibold">{post.username}</span> {post.caption}
                </div>
                <time className="text-muted-foreground text-xs flex-none uppercase mt-2 bottom-0">
                    {formatDate(post.postedAt)}
                </time>
            </div>
        </div>
    );
}