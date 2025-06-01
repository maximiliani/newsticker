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
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { ArticleService } from "../services/article-service";
import { logError } from "@/lib/utils/error-handling";
import { User } from "@supabase/supabase-js";

const formSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(100),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }).max(500),
  content: z.string().min(10, { message: "Content must be at least 10 characters" }),
  visibility_from: z.string().min(1, { message: "Visibility start date is required" }),
  visibility_to: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateArticleFormProps {
  onClose: () => void;
  onArticleCreated?: (articleId?: string) => void;
  user: User;
}

export function CreateArticleForm({ onClose, onArticleCreated, user }: CreateArticleFormProps) {
  const [loading, setLoading] = useState(false);
  // Add state to store the JSON content from TipTap editor
  const [jsonContent, setJsonContent] = useState<any>(null);

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

  // Handle editor content changes - capture both HTML and JSON
  const handleEditorChange = (html: string, json?: any) => {
    // Update the form field with HTML content
    form.setValue('content', html);
    // Store JSON content separately
    setJsonContent(json);
  };

  async function onSubmit(data: FormData) {
    try {
      setLoading(true);
      
      console.log('Form data before processing:', data);
      console.log('JSON content:', jsonContent);

      // Process the form data to include JSON content and handle optional visibility_to
      const processedData = {
        ...data,
        user_id: user.id,
        // Include the JSON content from the editor
        json_content: jsonContent,
        // Also include html_content if you want to store it separately
        html_content: data.content,
        // Convert empty string to undefined for visibility_to
        visibility_to: data.visibility_to && data.visibility_to.trim() !== '' 
          ? data.visibility_to 
          : undefined,
      };

      console.log('Processed data being sent to service:', processedData);

      const article = await ArticleService.createArticle(processedData);
      
      console.log('Article created successfully:', article);

      form.reset();
      setJsonContent(null); // Reset JSON content
      onArticleCreated?.(article.id);
    } catch (error) {
      console.error('Full error object:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      logError(error, 'CreateArticleForm.onSubmit');
      
      // More user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert(`Failed to create article: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                <RichTextEditor 
                  content={field.value}
                  onChange={handleEditorChange} // Use custom handler instead of field.onChange
                  placeholder="Write your article content here..."
                  userId={user.id}
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

        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-800 mt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={loading}
            className="border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          >
            {loading ? "Creating..." : "Create Article"}
          </Button>
        </div>
      </form>
    </Form>
  );
}