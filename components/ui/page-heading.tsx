import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeadingProps {
  heading: string;
  text?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeading({ heading, text, children, className }: PageHeadingProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
      {text && <p className="text-lg text-muted-foreground">{text}</p>}
      {children}
    </div>
  );
}
