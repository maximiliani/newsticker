import { ArticleManagerClient } from "./ArticleManagerClient";
import { createClient } from "@/utils/supabase/server";

export default async function ArticleManager() {
  const supabase = await createClient();
  
  // Fetch user and initial articles on the server
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please log in to view your articles
      </div>
    );
  }

  // Filter articles by the current user's ID
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('user_id', user.id) // Only get articles owned by the current user
    .order('created_at', { ascending: false });

  // Add debugging
  console.log('Articles fetched for user:', user.id);
  console.log('Articles count:', articles?.length || 0);
  console.log('Articles error:', error);

  return <ArticleManagerClient initialArticles={articles || []} user={user} />;
}