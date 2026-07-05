import * as React from 'react';

import type { TFileElement } from 'platejs';
import type { SlateElementProps } from 'platejs/static';

import { FileUp } from 'lucide-react';
import { SlateElement } from 'platejs/static';

import { cn } from '@/lib/utils';

export function FileElementStatic(props: SlateElementProps<TFileElement>) {
  const { name, url } = props.element;

  const isPdf = name?.toLowerCase().endsWith('.pdf') || url?.toLowerCase().includes('.pdf');

  return (
    <SlateElement className="my-px rounded-sm" {...props}>
      {isPdf ? (
        <div className="flex flex-col gap-2 my-4">
          <div className="flex items-center gap-2 p-2 bg-muted rounded-t-md border-x border-t">
            <FileUp className="size-5" />
            <span className="font-medium text-sm">{name}</span>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="ml-auto text-xs text-blue-500 hover:underline"
            >
              Open in new tab
            </a>
          </div>
          <div className="w-full aspect-[1/1.4] border rounded-b-md overflow-hidden bg-white">
            <iframe
              src={`${url}#toolbar=0`}
              className="w-full h-full border-none"
              title={name}
            />
          </div>
        </div>
      ) : (
        <a
          className={cn(
            'group relative m-0 flex cursor-pointer items-center rounded px-0.5 py-[3px] hover:bg-muted'
          )}
          download={name}
          href={url}
          rel="noopener noreferrer"
          role="button"
          target="_blank"
        >
          <div className={cn('flex items-center gap-1 p-1')}>
            <FileUp className="size-5" />
            <div>{name}</div>
          </div>
        </a>
      )}
      {props.children}
    </SlateElement>
  );
}
