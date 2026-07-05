'use client';

import * as React from 'react';

import type { TFileElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { useMediaState } from '@platejs/media/react';
import { ResizableProvider } from '@platejs/resizable';
import { FileUp } from 'lucide-react';
import { PlateElement, useReadOnly, withHOC } from 'platejs/react';

import { cn } from '@/lib/utils';
import { Caption, CaptionTextarea } from './caption';

export const FileElement = withHOC(
  ResizableProvider,
  function FileElement(props: PlateElementProps<TFileElement>) {
    const readOnly = useReadOnly();
    const { name, unsafeUrl } = useMediaState();

    const isPdf = name?.toLowerCase().endsWith('.pdf') || unsafeUrl?.toLowerCase().includes('.pdf');

    return (
      <PlateElement className="my-px rounded-sm" {...props}>
        {isPdf ? (
          <div className="flex flex-col gap-2" contentEditable={false}>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-t-md border-x border-t">
              <FileUp className="size-5" />
              <span className="font-medium text-sm">{name}</span>
              <a 
                href={unsafeUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="ml-auto text-xs text-blue-500 hover:underline"
              >
                Open in new tab
              </a>
            </div>
            <div className="w-full aspect-[1/1.4] border rounded-b-md overflow-hidden bg-white">
              <iframe
                src={`${unsafeUrl}#toolbar=0`}
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
            contentEditable={false}
            download={name}
            href={unsafeUrl}
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

        <Caption align="left">
          <CaptionTextarea
            className="text-left"
            readOnly={readOnly}
            placeholder="Write a caption..."
          />
        </Caption>
        {props.children}
      </PlateElement>
    );
  }
);
