
"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@radix-ui/react-icons";
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateArticleForm } from "@/components/CreateArticleForm";
import { useRouter } from 'next/navigation';

type NewsPreviewInputData = {
    id: string;
    title: string;
    description: string;
    createdAt: Date;
    modifiedAt?: Date;
    visibilityFrom: Date;
    visibilityTo: Date | null;
    author: {
        name: string;
        avatar?: string;
    };
};

interface ArticleFeedClientProps {
    initialArticles: NewsPreviewInputData[];
}

export function ArticleFeedClient({ initialArticles }: ArticleFeedClientProps) {
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const router = useRouter();

    const handleArticleCreated = useCallback(() => {
        setShowCreateDialog(false);
        // Refresh the server component data
        router.refresh();
    }, [router]);

    useEffect(() => {
        const supabase = createClient();
        
        // Set up real-time subscription for live updates
        const subscription = supabase
            .channel('articles_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'articles'
                },
                () => {
                    // Refresh server component when data changes
                    router.refresh();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [router]);

    return (
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0 relative">
            <h1 className="text-xl font-bold">Latest News</h1>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex items-center"
                        onClick={() => setShowCreateDialog(true)}
                    >
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Create news article
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Create news article</DialogTitle>
                    </DialogHeader>
                    <CreateArticleForm
                        onClose={() => setShowCreateDialog(false)}
                        onArticleCreated={handleArticleCreated}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}