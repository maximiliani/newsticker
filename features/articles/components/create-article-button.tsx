"use client";

import {Button} from "@/components/ui/button";
import {PlusIcon} from "@radix-ui/react-icons";
import {useRouter} from 'next/navigation';
import {User} from '@supabase/supabase-js';

interface CreateArticleButtonProps {
    user: User | null;
    title: string;
}

export function CreateArticleButton({user, title}: CreateArticleButtonProps) {
    const router = useRouter();

    if (user) {
        return (
            <Button
                size="sm"
                variant="outline"
                className="flex items-center"
                onClick={() => router.push('/news/create')}
            >
                <PlusIcon className="mr-2 h-4 w-4"/>
                {title}
            </Button>
        );
    }

    return (<></>);
}
