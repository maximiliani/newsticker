import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarViewClient } from "@/features/calendar/components/calendar-view-client";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch articles from the view
  const { data: articles, error } = await supabase
    .from('articles_with_author_info')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to fetch articles:', error);
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar</h1>
      </div>
      <CalendarViewClient initialArticles={articles || []} />
    </div>
  );
}
