import { ReactNode } from 'react';

// Define the correct types for Next.js App Router page components
declare namespace NextJS {
  interface PageProps {
    params?: Record<string, string | string[]>;
    searchParams?: Record<string, string | string[] | undefined>;
  }

  interface LayoutProps {
    children: ReactNode;
    params?: Record<string, string | string[]>;
  }
}

// Extend the global namespace
declare global {
  namespace React {
    interface FunctionComponent<P = {}> {
      // Add optional properties for Next.js App Router components
      (props: P, context?: any): ReactNode;
      displayName?: string;
    }
  }
}
