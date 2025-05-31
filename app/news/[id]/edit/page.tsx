import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { EditArticleForm } from "./EditArticleForm";

interface EditArticlePageProps {
    params: {
        id: string;
    };
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/sign-in');
    }

    // Fetch the article
    const { data: article, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id) // Ensure user owns this article
        .single();

    if (error || !article) {
        notFound();
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Edit Article</h1>
                <EditArticleForm article={article} />
            </div>
        </div>
    );
}