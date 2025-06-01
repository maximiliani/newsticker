"use client";

import { useRouter } from "next/navigation";
import { CreateArticleForm } from "@/features/articles/components/create-article-form";
import { User } from "@supabase/supabase-js";

interface CreateArticleClientProps {
  user: User;
}

export function CreateArticleClient({ user }: CreateArticleClientProps) {
  const router = useRouter();

  const handleClose = () => {
    router.push("/protected");
  };

  const handleArticleCreated = (articleId?: string) => {
    if (articleId) {
      // Navigate to the newly created article
      router.push(`/news/${articleId}`);
    } else {
      // Fallback to dashboard if no article ID
      router.push("/protected");
    }
    router.refresh();
  };

  return (
    <CreateArticleForm
      user={user}
      onClose={handleClose}
      onArticleCreated={handleArticleCreated}
    />
  );
}
