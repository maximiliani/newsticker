"use client";

import {Button} from "@/components/ui/button";
import {PlusIcon} from "@radix-ui/react-icons";
import {useRouter} from 'next/navigation';
import {User} from '@supabase/supabase-js';

interface CreateArticleButtonProps {
    user: User | null;
    onArticleCreated?: () => void;
}

export function CreateArticleButton({user, onArticleCreated}: CreateArticleButtonProps) {
    const router = useRouter();

    if (!user) {
        return (
            <Button
                size="sm"
                variant="outline"
                className="flex items-center"
                disabled
                onClick={() => router.push('/sign-in')}
            >
                <PlusIcon className="mr-2 h-4 w-4"/>
                Login to create news article
            </Button>
        );
    }

    return (
        <Button
            size="sm"
            variant="outline"
            className="flex items-center"
            onClick={() => router.push('/news/create')}
        >
            <PlusIcon className="mr-2 h-4 w-4"/>
            Create news article
        </Button>
    );
}
