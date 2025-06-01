import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Custom 404 Not Found page
 */
export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-6 max-w-md p-8">
        <h1 className="text-6xl font-bold">404</h1>

        <h2 className="text-2xl font-semibold">Page Not Found</h2>

        <p className="text-muted-foreground">
          We couldn't find the page you're looking for.
        </p>

        <div className="pt-4">
          <Button asChild>
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
