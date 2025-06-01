"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserService } from '@/features/users/services/user-service';
import { ArticleService, ArticlesByUser } from '@/features/articles/services/article-service';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, User, Eye, Calendar, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArticleManagerClient } from '@/features/articles/components/article-manager-client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Article } from '@/types/article';

export default function ArticlesPage() {
    const router = useRouter();
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [userArticles, setUserArticles] = useState<Article[]>([]);
    const [groupedArticles, setGroupedArticles] = useState<ArticlesByUser[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function checkAuthAndFetchData() {
            try {
                const supabase = createClient();
                
                // Check authentication
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }

                setUser(user);

                // Check admin status
                const isAdmin = await UserService.isCurrentUserAdmin();
                setIsAdmin(isAdmin);

                // Fetch user's articles
                try {
                    const fetchedUserArticles = await ArticleService.getUserArticles(user.id);
                    setUserArticles(fetchedUserArticles);
                    
                    // If admin, also fetch all articles grouped by user
                    if (isAdmin) {
                        const fetchedGroupedArticles = await ArticleService.getAllArticlesGroupedByUser();
                        setGroupedArticles(fetchedGroupedArticles);
                    }
                } catch (error) {
                    console.error('Error fetching articles:', error);
                    setError('Failed to load articles');
                    setUserArticles([]);
                    setGroupedArticles([]);
                }
            } catch (error) {
                console.error('Error in auth check:', error);
                setError('Authentication failed');
            } finally {
                setIsLoading(false);
            }
        }

        checkAuthAndFetchData();
    }, [router]);

    const handleDeleteArticle = async (articleId: string, userId: string) => {
        if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
            return;
        }

        try {
            await ArticleService.deleteArticle(articleId, userId);
            
            // Refresh the data
            if (user) {
                const fetchedUserArticles = await ArticleService.getUserArticles(user.id);
                setUserArticles(fetchedUserArticles);
                
                if (isAdmin) {
                    const fetchedGroupedArticles = await ArticleService.getAllArticlesGroupedByUser();
                    setGroupedArticles(fetchedGroupedArticles);
                }
            }
        } catch (error) {
            console.error('Error deleting article:', error);
            setError('Failed to delete article');
        }
    };

    const handleArticleCreated = async () => {
        if (user) {
            const fetchedUserArticles = await ArticleService.getUserArticles(user.id);
            setUserArticles(fetchedUserArticles);
            
            if (isAdmin) {
                const fetchedGroupedArticles = await ArticleService.getAllArticlesGroupedByUser();
                setGroupedArticles(fetchedGroupedArticles);
            }
        }
    };

    if (isLoading) {
        return (
            <DashboardShell>
                <PageHeading
                    heading="Article Management"
                    text="Manage your news articles"
                />
                <div className="my-8">
                    <Skeleton className="h-[500px] w-full" />
                </div>
            </DashboardShell>
        );
    }

    if (error) {
        return (
            <DashboardShell>
                <PageHeading
                    heading="Article Management"
                    text="Manage your news articles"
                />
                <div className="my-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    <p>{error}</p>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <PageHeading
                heading="Article Management"
                text={isAdmin ? "Manage all news articles across the platform" : "Manage your news articles"}
            />
            
            {user && (
                <Tabs defaultValue="my-articles" className="mt-6">
                    <TabsList>
                        <TabsTrigger value="my-articles">My Articles</TabsTrigger>
                        {isAdmin && <TabsTrigger value="all-articles">All User Articles</TabsTrigger>}
                    </TabsList>
                    
                    <TabsContent value="my-articles" className="mt-4">
                        <div className="flex justify-end mb-4">
                            <Button onClick={() => router.push('/news/create')} className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                Create New Article
                            </Button>
                        </div>
                        
                        {userArticles.length === 0 ? (
                            <Card>
                                <CardContent className="p-6 text-center">
                                    <p className="text-gray-500">You haven't created any articles yet.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <ArticleManagerClient 
                                initialArticles={userArticles} 
                                user={user} 
                                showDebug={false} 
                                onArticleCreated={handleArticleCreated}
                            />
                        )}
                    </TabsContent>
                    
                    {isAdmin && (
                        <TabsContent value="all-articles" className="mt-4">
                            <div className="space-y-6">
                                {groupedArticles.length === 0 ? (
                                    <Card>
                                        <CardContent className="p-6 text-center">
                                            <p className="text-gray-500">No articles found.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    groupedArticles.map((userGroup) => (
                                        <Card key={userGroup.userId}>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <User className="h-5 w-5" />
                                                    {userGroup.userFullName}
                                                    <Badge variant="secondary">{userGroup.userEmail}</Badge>
                                                    <Badge variant="outline">{userGroup.articles.length} articles</Badge>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {userGroup.articles.length === 0 ? (
                                                    <p className="text-gray-500 text-sm">No articles for this user.</p>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {userGroup.articles.map((article) => (
                                                            <div key={article.id} className="border rounded-lg p-4">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex-1">
                                                                        <h3 className="font-medium text-lg mb-2">{article.title}</h3>
                                                                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                                                                            {article.description}
                                                                        </p>
                                                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                                                            <div className="flex items-center gap-1">
                                                                                <Calendar className="h-4 w-4" />
                                                                                {new Date(article.created_at).toLocaleDateString()}
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                <Eye className="h-4 w-4" />
                                                                                {new Date(article.visibility_from).toLocaleDateString()}
                                                                                {article.visibility_to && 
                                                                                    ` - ${new Date(article.visibility_to).toLocaleDateString()}`
                                                                                }
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => handleDeleteArticle(article.id, userGroup.userId)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    )}
                </Tabs>
            )}
        </DashboardShell>
    );
}