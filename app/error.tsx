'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/utils/error-handling';

/**
 * Global error boundary for catching and displaying errors
 * This is a client component that renders when an error occurs
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the error reporting system
    logError(error, 'GlobalErrorBoundary');
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md p-6 bg-card border rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>

        <p className="text-muted-foreground">
          We're sorry, but we encountered an unexpected error.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="text-left bg-muted p-4 rounded overflow-auto max-h-40 text-xs">
            <p className="font-bold mb-2 text-foreground">Error details:</p>
            <p className="text-foreground">{error.message}</p>
            {error.stack && <pre className="text-foreground mt-2">{error.stack}</pre>}
          </div>
        )}

        <div className="flex justify-center gap-4">
          <Button onClick={() => window.location.href = '/'}>
            Go to home page
          </Button>
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
