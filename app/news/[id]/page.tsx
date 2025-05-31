import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ClickableAuthorAvatar } from '@/components/ClickableAuthorAvatar';

// Type for a single article fetched from the 'articles_with_author_info' view
type ArticleDetailFromView = {
    id: string;
    user_id: string | null; // user_id from the original table, can be null
    title: string;
    description: string;
    content: string; 
    created_at: string;
    modified_at: string;
    author_name: string | null; // From view
    author_avatar: string | null; // From view
    visibility_from: string;
    visibility_to: string;
};

type ArticlePageProps = {
    params: {
        id: string;
    };
};

async function getArticleById(id: string): Promise<ArticleDetailFromView | null> {
    const supabase = await createClient(); // Server client
    // Fetch from the view
    const { data, error } = await supabase
        .from('articles_with_author_info') 
        .select('*') // Select all columns from the view
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching article by ID from view:', error.message);
        return null;
    }
    return data as ArticleDetailFromView;
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

export default async function ArticlePage({ params }: ArticlePageProps) {
    const article = await getArticleById(params.id);

    if (!article) {
        notFound(); 
    }

    const now = new Date();
    const visibleFrom = new Date(article.visibility_from);
    const visibleTo = new Date(article.visibility_to);
    const isCurrentlyVisible = now >= visibleFrom && now <= visibleTo;
    
    const authorNameDisplay = article.author_name || 'Anonymous';
    const authorAvatarDisplay = article.author_avatar || undefined;

    return (
        <div className="container mx-auto p-4 lg:p-8 max-w-4xl">
            {/* Back to Dashboard Button */}
            <div className="mb-6">
                <Link href="/">
                    <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Dashboard</span>
                    </Button>
                </Link>
            </div>

            <article className="prose lg:prose-xl dark:prose-invert break-words">
                <header className="mb-8 border-b pb-4 dark:border-gray-700">
                     {!isCurrentlyVisible && ( // This badge might only show if RLS was more permissive for some roles
                        <Badge variant="outline" className="mb-2 bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-200 dark:border-yellow-500">
                            This article is currently not within its visibility period.
                        </Badge>
                    )}
                    <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">{article.title}</h1>
                    <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
                        <ClickableAuthorAvatar
                            author={{
                                name: authorNameDisplay,
                                avatar: authorAvatarDisplay,
                            }}
                        />
                        <div>
                            <p className="font-semibold">{authorNameDisplay}</p>
                            <p>Published: {formatDate(article.created_at)}</p>
                            {article.modified_at !== article.created_at && (
                                <p>Updated: {formatDate(article.modified_at)}</p>
                            )}
                        </div>
                    </div>
                    {article.description && (
                        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">{article.description}</p>
                    )}
                </header>

                <div
                    className="mt-6"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                />

                <footer className="mt-10 pt-6 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    <p>Article ID: {article.id}</p>
                    {article.user_id && <p>Author User ID: {article.user_id}</p>}
                    <p>Visibility: From {formatDate(article.visibility_from)} to {formatDate(article.visibility_to)}</p>
                </footer>
            </article>
        </div>
    );
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const article = await getArticleById(params.id);
  if (!article) {
    return {
      title: 'Article Not Found',
    };
  }
  return {
    title: article.title,
    description: article.description,
  };
}