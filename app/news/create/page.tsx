import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CreateArticleClient } from "./client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create News Article",
  description: "Create a new news article with rich text editor",
};

export default async function CreateArticlePage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
          <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/protected">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4"/>
              <span>Back to Dashboard</span>
            </Button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-8">Create New Article</h1>

        <div className="rounded-xl shadow-sm border p-6">
          <CreateArticleClient user={user} />
        </div>
      </div>
    </div>
  );
}
