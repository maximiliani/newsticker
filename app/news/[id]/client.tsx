"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Pen, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

interface ArticleActionsProps {
    articleId: string;
    articleTitle: string;
}

export function ArticleActions({ articleId, articleTitle }: ArticleActionsProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [articleToDelete, setArticleToDelete] = useState<string | null>(null);

    const router = useRouter();
    const { toast } = useToast();
    const supabase = createClient();

    const confirmDelete = (id: string) => {
        setArticleToDelete(id);
    };

    const handleDelete = async () => {
        if (!articleToDelete) return;

        setIsDeleting(true);

        try {
            const { error } = await supabase
                .from('articles')
                .delete()
                .eq('id', articleToDelete);

            if (error) {
                console.error('Error deleting article:', error.message);
                throw error;
            }

            toast({
                title: "Success",
                description: "Article deleted successfully",
            });

            // Redirect to dashboard
            router.push('/settings/articles');
        } catch (error) {
            console.error('Error deleting article:', error);
            toast({
                title: "Error",
                description: "Failed to delete article",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setArticleToDelete(null);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <Link href={`/news/${articleId}/edit`} className="inline-block">
                <Button variant="outline" size="sm">
                    <Pen data-icon="inline-start" />
                    Edit Article
                </Button>
            </Link>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => confirmDelete(articleId)}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <Trash2 />
                        )}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-gray-200 dark:border-gray-700 shadow-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                            This action cannot be undone. This will permanently delete the
                            article <span className="font-medium text-gray-900 dark:text-gray-100">"{articleTitle}"</span> and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel
                            className="border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => setArticleToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition-colors"
                            onClick={handleDelete}>
                            Delete Article
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
