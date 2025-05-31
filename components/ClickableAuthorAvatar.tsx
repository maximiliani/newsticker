"use client";

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfileDialog } from '@/components/UserProfileDialog';

interface ClickableAuthorAvatarProps {
    author: {
        name: string;
        avatar?: string;
        email?: string;
    };
}

export function ClickableAuthorAvatar({ author }: ClickableAuthorAvatarProps) {
    const [showAuthorDialog, setShowAuthorDialog] = useState(false);

    const handleAvatarClick = () => {
        setShowAuthorDialog(true);
    };

    return (
        <>
            <button 
                onClick={handleAvatarClick}
                className="p-0 bg-transparent border-0 hover:ring-2 hover:ring-primary rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                title={`View ${author.name}'s profile`}
            >
                <Avatar className="h-10 w-10 cursor-pointer">
                    <AvatarImage src={author.avatar} alt={author.name} />
                    <AvatarFallback>{author.name?.substring(0, 2).toUpperCase() || 'AU'}</AvatarFallback>
                </Avatar>
            </button>

            <UserProfileDialog
                open={showAuthorDialog}
                onOpenChange={setShowAuthorDialog}
                user={author}
                title="Author Profile"
            />
        </>
    );
}