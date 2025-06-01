"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArticleService } from "../services/article-service";
import { logError } from "@/lib/utils/error-handling";
import { User } from "@supabase/supabase-js";

const formSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(100),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }).max(500),
  content: z.string().min(50, { message: "Content must be at least 50 characters" }),
  visibility_from: z.string().min(1, { message: "Visibility start date is required" }),
  visibility_to: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateArticleFormProps {
  onClose: () => void;
  onArticleCreated?: () => void;
  user: User;
}

export function CreateArticleForm({ onClose, onArticleCreated, user }: CreateArticleFormProps) {
  const [loading, setLoading] = useState(false);

  // Set default visibility dates (now to 1 month from now)
  const now = new Date();
  const oneMonthFromNow = new Date(now);
  oneMonthFromNow.setMonth(now.getMonth() + 1);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      content: "",
      visibility_from: now.toISOString().split('T')[0],
      visibility_to: "", // Optional end date
    },
  });

  async function onSubmit(data: FormData) {
    try {
      setLoading(true);

      await ArticleService.createArticle({
        ...data,
        user_id: user.id,
      });

      form.reset();
      onArticleCreated?.();
    } catch (error) {
      logError(error, 'CreateArticleForm.onSubmit');
      alert("Failed to create article. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter article title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Brief description of the article" 
                  {...field} 
                  rows={2} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Full article content" 
                  {...field} 
                  rows={6}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="visibility_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visible From</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="visibility_to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visible Until (Optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Article"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
