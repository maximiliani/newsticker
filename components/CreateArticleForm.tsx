"use client";

import { useState, FormEvent, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User } from '@supabase/supabase-js';

// Structure for creating a new article
type ArticleInput = {
    title: string;
    description: string;
    content: string;
    visibility_from: string;
    visibility_to: string;
    // user_id will be added before insertion
};

interface CreateArticleFormProps {
    onClose?: () => void;
    onArticleCreated?: () => void;
}

export function CreateArticleForm({ onClose, onArticleCreated }: CreateArticleFormProps) {
    const supabase = createClient();
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    // Removed authorFullName and authorAvatarUrl states

    const [formData, setFormData] = useState<ArticleInput>({
        title: '',
        description: '',
        content: '',
        visibility_from: new Date().toISOString().substring(0, 16),
        visibility_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('Error fetching session:', sessionError);
                setAuthError('Could not fetch user session. Please try again.');
                return;
            }
            if (session?.user) {
                setCurrentUser(session.user);
                // No longer need to set authorFullName or authorAvatarUrl here for the form's state
            } else {
                setAuthError('You must be logged in to create an article.');
            }
        };
        fetchUser();
    }, [supabase]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setAuthError(null);

        if (!currentUser) {
            setAuthError('User not found. Please ensure you are logged in.');
            setIsSubmitting(false);
            return;
        }

        if (!formData.title || !formData.content || !formData.description) {
            setError("Title, Description, and Content are required.");
            setIsSubmitting(false);
            return;
        }

        const articleToInsert = {
            ...formData,
            user_id: currentUser.id, // Only user_id is needed for author association
            // author_name and author_avatar are no longer set here
            visibility_from: new Date(formData.visibility_from).toISOString(),
            visibility_to: new Date(formData.visibility_to).toISOString(),
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
        };

        // Inserts into the 'articles' table, not the view
        const { data, error: submissionError } = await supabase
            .from('articles') 
            .insert([articleToInsert])
            .select();

        setIsSubmitting(false);

        if (submissionError) {
            console.error('Error creating article:', submissionError);
            setError(`Failed to create article: ${submissionError.message}`);
        } else {
            console.log('Article created:', data);
            setFormData({
                title: '',
                description: '',
                content: '',
                visibility_from: new Date().toISOString().substring(0, 16),
                visibility_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
            });
            if (onArticleCreated) {
                onArticleCreated();
            }
            if (onClose) {
                onClose();
            }
        }
    };
    
    const userDisplayName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Current User';

    if (authError && !currentUser) {
         return <p className="text-red-500 p-4">{authError}</p>;
    }
    if (!currentUser && !authError) {
        return <p className="p-4">Loading user information...</p>;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
             <div className="mb-4 p-3 bg-secondary/30 rounded-md border border-border">
                <p className="text-sm font-medium">Author: {userDisplayName}</p>
                 {currentUser?.user_metadata?.avatar_url && 
                    <img src={currentUser.user_metadata.avatar_url} alt={userDisplayName} className="w-8 h-8 rounded-full mt-1"/>}
                <p className="text-xs text-muted-foreground">Posting as the currently logged-in user.</p>
            </div>
            
            <div>
                <Label htmlFor="title">Title</Label>
                <Input type="text" name="title" id="title" value={formData.title} onChange={handleChange} required />
            </div>
            <div>
                <Label htmlFor="description">Description</Label>
                <Textarea name="description" id="description" value={formData.description} onChange={handleChange} required />
            </div>
            <div>
                <Label htmlFor="content">Content</Label>
                <Textarea name="content" id="content" value={formData.content} onChange={handleChange} rows={8} required />
            </div>
            <div>
                <Label htmlFor="visibility_from">Visible From</Label>
                <Input 
                    type="datetime-local" 
                    name="visibility_from" 
                    id="visibility_from" 
                    value={formData.visibility_from}
                    onChange={handleDateChange} 
                    required
                />
            </div>
            <div>
                <Label htmlFor="visibility_to">Visible To</Label>
                <Input 
                    type="datetime-local" 
                    name="visibility_to" 
                    id="visibility_to" 
                    value={formData.visibility_to}
                    onChange={handleDateChange} 
                    required
                />
            </div>
            
            <div className="flex justify-end space-x-2 pt-2">
                {onClose && (
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={isSubmitting || !currentUser}>
                    {isSubmitting ? 'Creating...' : 'Create Article'}
                </Button>
            </div>
        </form>
    );
}