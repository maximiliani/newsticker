'use client';

import { useState, useEffect } from "react";
import { RefreshCcw, Trash2, Loader2, Calendar as CalendarIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarSubscription } from "@/types/calendar";
import { SubscriptionDialog } from "./subscription-dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/features/calendar/subscriptions');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSubscriptions(data);
      }
    } catch (e: any) {
      console.error('Failed to fetch subscriptions:', e);
      alert(e.message || 'Failed to fetch subscriptions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (id: string) => {
    try {
      setSyncingId(id);
      await fetch(`/api/features/calendar/subscriptions/${id}/sync`, { method: 'POST' });
      await fetchSubscriptions();
    } catch (e: any) {
      console.error('Failed to sync:', e);
      alert(e.message || 'Failed to sync subscription');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await fetch(`/api/features/calendar/subscriptions/${id}`, { method: 'DELETE' });
      setSubscriptions(subs => subs.filter(s => s.id !== id));
    } catch (e: any) {
      console.error('Failed to delete:', e);
      alert(e.message || 'Failed to delete subscription');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading && subscriptions.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SubscriptionDialog
          onSubscriptionAdded={fetchSubscriptions}
          existingColors={subscriptions.map(s => s.color)}
        />
      </div>

      <div className="grid gap-4">
        {subscriptions.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/50">
            <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No subscriptions yet</h3>
            <p className="text-muted-foreground">Add a public iCal URL or a CalDAV account to get started.</p>
          </div>
        ) : (
          subscriptions.map(sub => (
            <div key={sub.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: sub.color }}
                />
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {sub.name}
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {sub.auth_type === 'public' ? 'Public' : 'CalDAV'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last synced: {sub.last_synced_at ? new Date(sub.last_synced_at).toLocaleString() : 'Never'}
                  </div>
                  {sub.user && (
                    <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                      Owner: {sub.user.full_name || sub.user.email}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SubscriptionDialog
                  subscription={sub}
                  onSubscriptionUpdated={fetchSubscriptions}
                  existingColors={subscriptions.map(s => s.color)}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!!syncingId}
                  onClick={() => handleSync(sub.id)}
                >
                  {syncingId === sub.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{sub.name}"? This will also delete all articles created from this calendar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(sub.id)}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        {deletingId === sub.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
