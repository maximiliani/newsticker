"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Article } from "@/types/article";

interface EditArticleFormProps {
  article: Article;
}

export function EditArticleForm({ article }: EditArticleFormProps) {
  const [title, setTitle] = useState(article.title);
  const [description, setDescription] = useState(article.description);
  const [content, setContent] = useState(article.content);
  const [visibilityFrom, setVisibilityFrom] = useState(
    new Date(article.visibility_from).toISOString().slice(0, 16)
  );
  const [visibilityTo, setVisibilityTo] = useState(
    article.visibility_to 
      ? new Date(article.visibility_to).toISOString().slice(0, 16)
      : ""
  );
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate required fields
      if (!title.trim() || !description.trim() || !content.trim() || !visibilityFrom) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      // Validate dates
      const fromDate = new Date(visibilityFrom);
      const toDate = visibilityTo ? new Date(visibilityTo) : null;

      if (toDate && toDate <= fromDate) {
        toast({
          title: "Error",
          description: "End date must be after start date",
          variant: "destructive",
        });
        return;
      }

      // Update the article
      const { error } = await supabase
        .from('articles')
        .update({
          title: title.trim(),
          description: description.trim(),
          content: content.trim(),
          visibility_from: fromDate.toISOString(),
          visibility_to: toDate ? toDate.toISOString() : null,
          modified_at: new Date().toISOString(),
        })
        .eq('id', article.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Article updated successfully",
      });

      // Navigate back to article manager
      router.push('/protected');
      router.refresh();
    } catch (error) {
      console.error('Error updating article:', error);
      toast({
        title: "Error",
        description: "Failed to update article. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/protected');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter article title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter article description"
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter article content"
          rows={10}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="visibilityFrom">Visible From *</Label>
          <Input
            id="visibilityFrom"
            type="datetime-local"
            value={visibilityFrom}
            onChange={(e) => setVisibilityFrom(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="visibilityTo">Visible Until (Optional)</Label>
          <Input
            id="visibilityTo"
            type="datetime-local"
            value={visibilityTo}
            onChange={(e) => setVisibilityTo(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Updating..." : "Update Article"}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}