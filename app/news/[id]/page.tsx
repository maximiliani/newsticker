import {createClient} from '@/lib/supabase/server';
import {notFound} from 'next/navigation';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {ArrowLeft} from 'lucide-react';
import Link from 'next/link';
import {ClickableAuthorAvatar} from '@/components/ClickableAuthorAvatar';
import {ArticleActions} from '@/app/news/[id]/client';

// Type for a single article fetched from the 'articles_with_author_info' view
type ArticleDetailFromView = {
    id: string;
    user_id: string | null;
    title: string;
    description: string;
    content: string;
    json_content?: any; // Add json_content
    html_content?: string; // Add html_content
    created_at: string;
    modified_at: string;
    author_name: string | null;
    author_avatar: string | null;
    visibility_from: string;
    visibility_to: string;
};

type ArticlePageProps = {
    params: Promise<{ id: string; }>;
};

async function getArticleById(id: string): Promise<ArticleDetailFromView | null> {
    const supabase = await createClient();
    const {data, error} = await supabase
        .from('articles_with_author_info')
        .select('*') // This will include json_content and html_content
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

// Component to render article content with proper Plate.js styling
function ArticleContent({ article }: { article: ArticleDetailFromView }) {
    // Prefer html_content, then content as fallback
    const contentToRender = article.html_content || article.content;
    
    return (
        <div 
            className="simple-editor-content prose lg:prose-xl dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{__html: contentToRender}}
        />
    );
}

export default async function ArticlePage({params}: ArticlePageProps) {
    const supabase = await createClient();
    const resolvedParams = await params;

    // Fetch user and article on the server
    const {data: {user}} = await supabase.auth.getUser();
    const article = await getArticleById(resolvedParams.id);

    if (!article) {
        notFound();
    }

    const now = new Date();
    const visibleFrom = new Date(article.visibility_from);
    const visibleTo = new Date(article.visibility_to);
    const isCurrentlyVisible = now >= visibleFrom && now <= visibleTo;

    const authorNameDisplay = article.author_name || 'Anonymous';
    const authorAvatarDisplay = article.author_avatar || undefined;

    // Check if current user owns this article
    const isOwner = user && article.user_id === user.id;

    return (
        <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-4xl">
            {/* Back to Dashboard Button */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                            <ArrowLeft className="h-4 w-4"/>
                            <span>Back to Dashboard</span>
                        </Button>
                    </Link>

                    {/* Edit and Delete buttons - only show to owner */}
                    {isOwner && (
                        <ArticleActions
                            articleId={article.id}
                            articleTitle={article.title}
                        />
                    )}
                </div>
            </div>

            <article className="space-y-6 rounded-xl shadow-sm border overflow-auto">
                <header className="p-6 border-b">
                    {!isCurrentlyVisible && (
                        <Badge variant="outline"
                               className="mb-4 px-3 py-1 text-sm bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-200 dark:border-yellow-500">
                            This article is currently not within its visibility period.
                        </Badge>
                    )}
                    <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight prose dark:prose-invert">{article.title}</h1>
                    {article.description && (
                        <div className="my-4 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-lg prose dark:prose-invert">{article.description}</p>
                        </div>
                    )}
                    <div className="flex items-center space-x-3 text-sm">
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
                </header>

                {/* Use the new ArticleContent component */}
                <div className="px-4 py-4">
                    <ArticleContent article={article} />
                </div>

                <footer className="px-6 py-4 text-xs border-t dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <p>Article ID: {article.id}</p>
                            {article.user_id && <p>Author ID: {article.user_id}</p>}
                        </div>
                        <div className="text-right">
                            <p>Visible from: {formatDate(article.visibility_from)}</p>
                            <p>Visible until: {formatDate(article.visibility_to)}</p>
                        </div>
                    </div>
                </footer>
            </article>
        </div>
    );
}

export async function generateMetadata({params}: ArticlePageProps) {
    const resolvedParams = await params;
    const article = await getArticleById(resolvedParams.id);

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