"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Pen, Trash2 } from 'lucide-react';
import Link from 'next/link';
// Import TipTap styles for proper content rendering
import '@/components/tiptap/tiptap.css';
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
                <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Pen className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-400"/>
                    Edit Article
                </Button>
            </Link>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="bg-red-100 hover:bg-red-200 text-red-600 border border-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:border-red-800/50"
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

    // Component to render article content with proper TipTap styling
    function ArticleContent({ article }: { article: ArticleDetailFromView }) {
    // Use content from the article
    const contentToRender = article.content;

    return (
        <div 
            className="simple-editor-content prose lg:prose-xl dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{__html: contentToRender}}
        />
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
        <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-4xl">
            {/* Back to Dashboard Button */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <Link href="/protected">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
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

            <article className="space-y-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <header className="p-6 border-b dark:border-gray-800">
                    {!isCurrentlyVisible && (
                        <Badge variant="outline"
                               className="mb-4 px-3 py-1 text-sm bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-200 dark:border-yellow-500">
                            This article is currently not within its visibility period.
                        </Badge>
                    )}
                    <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight prose dark:prose-invert">{initialArticle.title}</h1>
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
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-lg text-gray-700 dark:text-gray-300 prose dark:prose-invert">{initialArticle.description}</p>
                        </div>
                    )}
                </header>

                <div className="px-6 py-4">
                    <ArticleContent article={initialArticle} />
                </div>

                <footer className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <p>Article ID: {initialArticle.id}</p>
                            {initialArticle.user_id && <p>Author ID: {initialArticle.user_id}</p>}
                        </div>
                        <div className="text-right">
                            <p>Visible from: {formatDate(initialArticle.visibility_from)}</p>
                            <p>Visible until: {formatDate(initialArticle.visibility_to)}</p>
                        </div>
                    </div>
                </footer>
            </article>
        </div>
    );
}
