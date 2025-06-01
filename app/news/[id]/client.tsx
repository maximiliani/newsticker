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
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { ClickableAuthorAvatar } from '@/components/ClickableAuthorAvatar';
import { User } from '@supabase/supabase-js';

// Type for a single article fetched from the 'articles_with_author_info' view
type ArticleDetailFromView = {
    id: string;
    user_id: string | null;
    title: string;
    description: string;
    content: string;
    created_at: string;
    modified_at: string;
    author_name: string | null;
    author_avatar: string | null;
    visibility_from: string;
    visibility_to: string;
};

interface ArticlePageClientProps {
    initialArticle: ArticleDetailFromView;
    user: User | null;
}

interface ArticleActionsProps {
    articleId: string;
    articleTitle: string;
}

const formatDate = (dateString?: string | null): string => {
    if (!dateString) return "N/A";
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    } catch (e) {
        return "Invalid date";
    }
};

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
            router.push('/protected');
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
        <div className="flex items-center gap-2">
            <Link href={`/news/${articleId}/edit`}>
                <Button variant="secondary" size="sm">
                    <Pen className="h-4 w-4 mr-2"/>
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
                            <Loader2 className="h-4 w-4 animate-spin"/>
                        ) : (
                            <Trash2 className="h-4 w-4"/>
                        )}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            article "{articleTitle}" and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setArticleToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={handleDelete}>
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export function ArticlePageClient({ initialArticle, user }: ArticlePageClientProps) {
    const now = new Date();
    const visibleFrom = new Date(initialArticle.visibility_from);
    const visibleTo = new Date(initialArticle.visibility_to);
    const isCurrentlyVisible = now >= visibleFrom && now <= visibleTo;

    const authorNameDisplay = initialArticle.author_name || 'Anonymous';
    const authorAvatarDisplay = initialArticle.author_avatar || undefined;

    // Check if current user owns this article
    const isOwner = user && initialArticle.user_id === user.id;

    return (
        <div className="container mx-auto p-4 lg:p-8 max-w-4xl">
            {/* Back to Dashboard Button */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <Link href="/protected">
                        <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                            <ArrowLeft className="h-4 w-4"/>
                            <span>Back to Dashboard</span>
                        </Button>
                    </Link>

                    {/* Edit and Delete buttons - only show to owner */}
                    {isOwner && (
                        <ArticleActions
                            articleId={initialArticle.id}
                            articleTitle={initialArticle.title}
                        />
                    )}
                </div>
            </div>

            <article className="prose lg:prose-xl dark:prose-invert break-words">
                <header className="mb-8 border-b pb-4 dark:border-gray-700">
                    {!isCurrentlyVisible && (
                        <Badge variant="outline"
                               className="mb-2 bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-200 dark:border-yellow-500">
                            This article is currently not within its visibility period.
                        </Badge>
                    )}
                    <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">{initialArticle.title}</h1>
                    <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
                        <ClickableAuthorAvatar
                            author={{
                                name: authorNameDisplay,
                                avatar: authorAvatarDisplay,
                            }}
                        />
                        <div>
                            <p className="font-semibold">{authorNameDisplay}</p>
                            <p>Published: {formatDate(initialArticle.created_at)}</p>
                            {initialArticle.modified_at !== initialArticle.created_at && (
                                <p>Updated: {formatDate(initialArticle.modified_at)}</p>
                            )}
                        </div>
                    </div>
                    {initialArticle.description && (
                        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">{initialArticle.description}</p>
                    )}
                </header>

                <div
                    className="mt-6"
                    dangerouslySetInnerHTML={{__html: initialArticle.content}}
                />

                <footer className="mt-10 pt-6 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    <p>Article ID: {initialArticle.id}</p>
                    {initialArticle.user_id && <p>Author User ID: {initialArticle.user_id}</p>}
                    <p>Visibility: From {formatDate(initialArticle.visibility_from)} to {formatDate(initialArticle.visibility_to)}</p>
                </footer>
            </article>
        </div>
    );
}