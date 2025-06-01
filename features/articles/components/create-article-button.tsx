"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@radix-ui/react-icons";
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateArticleForm } from "./create-article-form";
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

interface CreateArticleButtonProps {
    user: User | null;
    onArticleCreated?: () => void;
}

export function CreateArticleButton({ user, onArticleCreated }: CreateArticleButtonProps) {
    const [showCreateDialog, setShowCreateDialog] = useState(false);
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
        // <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        //     <DialogTrigger asChild>
        //         <Button
        //             size="sm"
        //             variant="outline"
        //             className="flex items-center"
        //             onClick={() => setShowCreateDialog(true)}
        //         >
        //             <PlusIcon className="mr-2 h-4 w-4"/>
        //             Create news article
        //         </Button>
        //     </DialogTrigger>
        //     <DialogContent className="sm:max-w-[800px] md:max-w-[900px]">
        //         <DialogHeader>
        //             <DialogTitle>Create news article</DialogTitle>
        //         </DialogHeader>
        //         <CreateArticleForm
        //             onClose={() => setShowCreateDialog(false)}
        //             onArticleCreated={() => {
        //                 setShowCreateDialog(false);
        //                 onArticleCreated?.();
        //             }}
        //             user={user}
        //         />
        //     </DialogContent>
        // </Dialog>
    );
}
