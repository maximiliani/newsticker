"use client";

import {useEffect, useState} from 'react';
import {notFound, useParams} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {ArrowLeft} from 'lucide-react';
import Link from 'next/link';
import { ClickableAuthorAvatar } from '@/components/ClickableAuthorAvatar';
import { ArticleActions } from '@/app/news/[id]/client';
import { createSlateEditor } from 'platejs';
import { BaseEditorKit } from '@/components/editor/editor-base-kit';
import { EditorStatic } from '@/components/ui/editor-static';

// Metadata for an article fetched from the 'articles_with_author_info' view
// (this view intentionally does NOT expose the article body).
type ArticleDetailFromView = {
    id: string;
    user_id: string | null;
    title: string;
    description: string;
    created_at: string;
    modified_at: string;
    author_name: string | null;
    author_avatar: string | null;
    visibility_from: string;
    visibility_to: string | null;
};

// Body returned by the get_public_article_body RPC. The body fields are only
// populated when the caller is the owner/admin or the article is currently
// visible; otherwise only { id, visible:false, isOwner:false } is returned.
type ArticleBodyPayload = {
    id: string;
    visible: boolean;
    isOwner: boolean;
    content?: string;
    json_content?: any;
    html_content?: string;
};

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

// Component to render article body with proper Plate.js styling
function ArticleBody({ body }: { body: ArticleBodyPayload }) {
    if (body.json_content) {
        const editor = createSlateEditor({
            plugins: BaseEditorKit,
            value: body.json_content,
        });

        return (
            <div className="simple-editor-content prose lg:prose-xl dark:prose-invert max-w-none">
                <EditorStatic editor={editor} />
            </div>
        );
    }

    // Prefer html_content, then content as fallback
    const contentToRender = body.html_content || body.content || '';

    return (
        <div
            className="simple-editor-content prose lg:prose-xl dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{__html: contentToRender}}
        />
    );
}

export default function ArticlePage() {
    const params = useParams<{ id: string }>();
    const id = params?.id;

    const [article, setArticle] = useState<ArticleDetailFromView | null>(null);
    const [body, setBody] = useState<ArticleBodyPayload | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        let cancelled = false;
        const supabase = createClient();

        (async () => {
            // Fetch article metadata from the public view (no body exposed here).
            const {data: meta, error: metaError} = await supabase
                .from('articles_with_author_info')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            // Fetch the article body through the visibility-enforcing RPC. This
            // returns the body only when the article is currently visible OR the
            // caller is the owner/admin.
            const {data: bodyData} = await supabase
                .rpc('get_public_article_body', {p_article_id: id});

            if (!cancelled) {
                if (metaError || !meta) {
                    setArticle(null);
                } else {
                    setArticle(meta as ArticleDetailFromView);
                }
                setBody((bodyData as ArticleBodyPayload | null) ?? null);
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 max-w-4xl">
                <div className="animate-pulse space-y-6">
                    <div className="h-10 w-40 bg-muted rounded" />
                    <div className="h-72 bg-muted rounded-xl" />
                </div>
            </div>
        );
    }

    if (!article) {
        notFound();
    }

    const isOwner = !!body?.isOwner;
    const isCurrentlyVisible = body?.visible ?? false;

    const authorNameDisplay = article.author_name || 'Anonymous';
    const authorAvatarDisplay = article.author_avatar || undefined;

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

                {/* Article body - hidden for non-editors outside the visibility window */}
                <div className="px-4 py-4">
                    {isOwner || isCurrentlyVisible ? (
                        body ? (
                            <ArticleBody body={body} />
                        ) : (
                            <p className="text-muted-foreground">
                                This article is not currently available.
                            </p>
                        )
                    ) : (
                        <p className="text-muted-foreground">
                            This article is not currently available.
                        </p>
                    )}
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
