'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { logError } from '@/lib/utils/error-handling';

/**
 * Interface for hook return values
 */
interface UseAuthResult {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  error: Error | null;
}

/**
 * Hook for managing authentication state
 * 
 * Provides access to the current user, loading state, and sign-out functionality
 * Also handles real-time updates to authentication state
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    const initializeAuth = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;
        setUser(session?.user ?? null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize auth');
        logError(error, 'useAuth.initializeAuth');
        setError(error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Clean up subscription when component unmounts
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Sign out the current user
   */
  const signOut = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign out');
      logError(error, 'useAuth.signOut');
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, signOut, error };
}
