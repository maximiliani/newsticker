import {MediaDisplay, InstagramMediaDisplay} from "@/components/media-display";
import {Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,} from "@/components/ui/carousel";
import {createClient} from "@/lib/supabase/client";
import {formatDate} from "@/utils/utils";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import {useEffect, useState} from "react";

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

export function IGPost({postId}: {postId: string}) {
    const supabase = createClient();
    const [post, setPost] = useState<IGPostData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPost() {
            setLoading(true);
            setError(null);

            try {
                const {data, error} = await supabase
                    .from("instagram_posts")
                    .select(`
                        *,
                        instagram_post_media (
                            media_type,
                            media_url,
                            local_media_url,
                            local_thumbnail_url,
                            download_status
                        ),
                        instagram_accounts (
                            username,
                            profile_image_url
                        )
                    `)
                    .eq("id", postId)
                    .single();

                if (error) {
                    throw new Error(error.message);
                }

                if (!data) {
                    throw new Error("Post not found");
                }

                const postData = mapPostData(data);
                setPost(postData);
            } catch (err: any) {
                console.error("Error fetching Instagram post:", err.message);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchPost();
    }, [postId]);

    const mapPostData = (data: any): IGPostData => {
        const media = data.instagram_post_media.map((media: any) => {
            // Use local URL if available and download completed, otherwise fallback to Meta URL
            const preferredUrl = (media.local_media_url && media.download_status === 'completed') 
                ? media.local_media_url 
                : media.media_url;
            
            return {
                type: media.media_type,
                url: preferredUrl,
                // Add the missing properties that InstagramMediaDisplay expects
                media_url: media.media_url,
                thumbnail_url: media.thumbnail_url,
                local_media_url: media.local_media_url,
                local_thumbnail_url: media.local_thumbnail_url,
                download_status: media.download_status,
            };
        });

        return {
            id: data.id,
            username: data.instagram_accounts.username,
            userAvatar: data.instagram_accounts.profile_image_url,
            location: data.location || null,
            media,
            caption: data.caption || null,
            postedAt: new Date(data.posted_at || data.timestamp),
        };
    };
    
    if (loading) {
        // Ensure loading placeholder also respects sizing if needed, or use simpler fixed size
        return <div className="animate-pulse bg-gray-200 w-full h-full rounded-lg"></div>;
    }
    if (error) {
        return <div className="text-red-500 p-2 w-full h-full">{error}</div>;
    }
    if (!post) {
        return <div className="text-gray-500 p-2 w-full h-full">No post found</div>;
    }

    return (
        <div className="bg-card rounded-lg overflow-hidden shadow-sm border w-full h-full flex flex-col">
            {/* Post Header */}
            <div className="p-2 flex items-center space-x-2 h-10 flex-none border-b">
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

            {/* Post Media Content */}
            <div className="w-full flex-1 overflow-hidden relative">
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