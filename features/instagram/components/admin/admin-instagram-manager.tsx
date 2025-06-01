"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { InstagramService } from '@/features/instagram/services/instagram-service';
import { InstagramPost } from '@/types/instagram';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrashIcon } from 'lucide-react';

interface AdminInstagramManagerProps {
  initialPosts: InstagramPost[];
}

export function AdminInstagramManager({ initialPosts }: AdminInstagramManagerProps) {
  const [posts, setPosts] = useState<InstagramPost[]>(initialPosts);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePost = async () => {
    if (!selectedPost) return;

    try {
      setIsDeleting(true);

      // Call service to delete the post
      await InstagramService.deletePost(selectedPost.id);

      // Update local state
      setPosts(posts.filter(post => post.id !== selectedPost.id));
      setIsDeleteDialogOpen(false);
      toast.success('Instagram post deleted successfully');
    } catch (error) {
      console.error('Failed to delete Instagram post:', error);
      toast.error('Failed to delete Instagram post');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.length > 0 ? (
          posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              {post.media_url && (
                <div className="aspect-square relative overflow-hidden">
                  <img 
                    src={post.media_url} 
                    alt={post.caption || 'Instagram post'} 
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center">
                  <span className="truncate">User ID: {post.user_id}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setSelectedPost(post);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Posted: {new Date(post.created_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {post.caption && (
                  <ScrollArea className="h-24">
                    <p className="text-sm">{post.caption}</p>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="col-span-3 text-center text-muted-foreground py-10">
            No Instagram posts found.
          </p>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Instagram Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this Instagram post? This action cannot be undone and will permanently remove the post and all associated media.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePost}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
