import {MediaDisplay, InstagramMediaDisplay} from "@/components/media-display";
import {Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,} from "@/components/ui/carousel";
import {createClient} from "@/utils/supabase/client";
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
}
    
    if (loading) {
        return <div className="animate-pulse bg-gray-200 h-96 w-64 rounded-lg"></div>;
    }
    if (error) {
        return <div className="text-red-500">{error}</div>;
    }
    if (!post) {
        return <div className="text-gray-500">No post found</div>;
    }

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
                    <InstagramMediaDisplay
                        media={post.media[0]}
                        type={post.media[0].type}
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
                                <CarouselItem key={`${media.url}-${index}`} className="w-full">
                                    <InstagramMediaDisplay
                                        media={media}
                                        type={media.type}
                                        className="w-full h-full object-cover"
                                    />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="left-2"/>
                        <CarouselNext className="right-2"/>
                    </Carousel>
                )}
            </div>

            {/* Caption and Date */}
            <div className="p-2 text-xs flex flex-col h-28 flex-none">
                <div
                    className="flex-1 overflow-y-auto hover:overflow-y-scroll line-clamp-3 group-hover:line-clamp-none max-h-12">
                    <span className="font-semibold">{post.username}</span> {post.caption}
                </div>
                <time className="text-muted-foreground text-xs flex-none uppercase mt-2 bottom-0">
                    {formatDate(post.postedAt)}
                </time>
            </div>
        </div>
    );
}

export default IGPost;