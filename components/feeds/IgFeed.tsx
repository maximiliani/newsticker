"use client";
import { IGPost, IGPostData } from "@/components/ig-post";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { data } from "autoprefixer";

const mockInstagramFeed: IGPostData[] = [
    {
      id: '1',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba',
        },
        {
            type: 'video',
            url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        }
      ],
      caption: 'Beautiful sunset at the beach 🌅 Perfect end to a perfect day! #sunset #beach #nature #photography',
      username: 'travelphotographer',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
      location: 'Maldives Beach Resort',
      postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), 
    },
    {
      id: '2',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1682687221038-404670f09471',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild1/500/700',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild2/500/700',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild3/500/700',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild4/500/700',
        }
      ],
      caption: 'City lights never sleep 🌃 The urban jungle comes alive at night #cityscape #nightphotography #urban',
      username: 'urbanexplorer',
      userAvatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12',
      location: 'Downtown Manhattan',
      postedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), 
    },
    {
      id: '3',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1682687220198-88e9bdea9931',
        }
      ],
      caption: 'Peak adventures 🏔️ Nothing beats the feeling of reaching the summit #mountains #hiking #adventure',
      username: 'adventureseeker',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      location: 'Swiss Alps',
      postedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), 
    },
    {
      id: '4',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38',
        }
      ],
      caption: 'Homemade pizza night! 🍕 Nothing beats the smell of fresh basil and melted mozzarella #foodie #homecooking',
      username: 'foodiechef',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80',
      location: 'Home Kitchen Studio',
      postedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), 
    },
    {
      id: '5',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild5/500/700',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild6/500/700',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild7/500/700',
        }
      ],
      caption: 'Perfecting the art of plating 🍽️ #finedining #chefsofinstagram #foodart',
      username: 'masterchef',
      userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
      location: 'Gourmet Restaurant',
      postedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), 
    },
    {
      id: '6',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b',
        }
      ],
      caption: 'Latest tech setup complete! 💻 Productivity level: maximum #techie #workspace #setup',
      username: 'techgeek',
      userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
      location: 'Tech Hub',
      postedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), 
    },
    {
      id: '7',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild8/500/700',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild9/500/700',
        },
      ],
      caption: 'Unboxing the latest gadget! 📱 First impressions coming soon #tech #unboxing #newrelease',
      username: 'techreviewer',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
      location: 'Tech Review Studio',
      postedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), 
    },
    {
      id: '8',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2',
        }
      ],
      caption: 'Latest tech setup complete! 💻 Productivity level: maximum #techie #workspace #setup',
      username: 'techreviewer',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
      location: 'Tech Review Studio',
      postedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), 
    },
    {
      id: '9',
      media: [
        {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild10/500/700',
        },
      ],
      caption: 'Latest tech setup complete! 💻 Productivity level: maximum #techie #workspace #setup',
      username: 'techreviewer',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
      location: 'Tech Review Studio',
      postedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), 
    },
    {
      id: '10',
      media:[
        {
          type: 'image',
          url: 'https://picsum.photos/bild11/500/700',
        },
        {
          type: 'image',
          url: 'https://picsum.photos/bild12/500/700',
        },
      ],
      caption: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      username: 'techreviewer',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
      location: 'Tech Review Studio',
      postedAt: new Date(Date.now() - 345678765 * 60 * 60 * 1000), 
    }
  ];

export default function IgFeed() {
    const [availableUsers, setAvailableUsers] = useState<string[]>(Array.from(new Set(mockInstagramFeed.flatMap((post) => post.username))));
    const [activeUsers, setActiveUsers] = useState<string[]>(["all", ...availableUsers]);
    const [activePosts, setActivePosts] = useState<IGPostData[]>(mockInstagramFeed);

    useEffect(() => {
        setActiveUsers(mockInstagramFeed.map((post) => post.username));
        setActivePosts(mockInstagramFeed.filter((post) => activeUsers.includes(post.username)));
    }, [mockInstagramFeed]);

    useEffect(() => {
        setActivePosts(mockInstagramFeed.filter((post) => activeUsers.includes(post.username)));
    }, [activeUsers]);

    const areAllUsersSelected = activeUsers.length === availableUsers.length;

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-xl font-bold">Instagram Feed</h2>

            {/* User Selector */}
            <div className="justify-center items-center my-4">
                <ToggleGroup 
                    variant="outline" 
                    type="multiple"
                    orientation="horizontal"
                    value={activeUsers}
                    onValueChange={(value) => {
                        if (value.includes("all")) {
                            if (areAllUsersSelected) {
                                setActiveUsers([]);
                            } else {
                                setActiveUsers([...availableUsers]);
                            }
                        } else {
                            setActiveUsers(value);
                        }
                    }}
                    className="flex flex-wrap gap-2"
                >
                    <ToggleGroupItem 
                        key="all" 
                        value="all" 
                        aria-label="All"
                        defaultChecked
                        className="hover:bg-primary hover:text-primary-foreground"
                        data-state={areAllUsersSelected ? "on" : "off"}
                    >
                        All
                    </ToggleGroupItem>
                    {availableUsers.map((username) => (
                        <ToggleGroupItem
                            key={username}
                            value={username}
                            aria-label={username}
                            className="hover:bg-primary hover:text-primary-foreground"
                            data-state={activeUsers.includes(username) ? "on" : "off"}
                        >
                            {username}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            {/* Posts Container */}
            <div className="flex-1 overflow-y-auto">
                <div className="grid auto-rows-max grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4 p-2 place-items-center">
                    {activePosts.map((post) => (
                        <div className="w-64" key={post.id}>
                            <IGPost post={post} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}