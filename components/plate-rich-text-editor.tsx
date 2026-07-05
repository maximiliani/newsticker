'use client';

import * as React from 'react';
import { Plate, usePlateEditor } from 'platejs/react';
import { createSlateEditor } from 'platejs';
import { serializeHtml, getEditorDOMFromHtmlString } from 'platejs/static';
import { EditorKit } from '@/components/editor/editor-kit';
import { BaseEditorKit } from '@/components/editor/editor-base-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { EditorStatic } from '@/components/ui/editor-static';
import { FixedToolbar } from '@/components/ui/fixed-toolbar';
import { FixedToolbarButtons } from '@/components/ui/fixed-toolbar-buttons';
import { FloatingToolbar } from '@/components/ui/floating-toolbar';
import { FloatingToolbarButtons } from '@/components/ui/floating-toolbar-buttons';
import { cn } from "@/lib/utils";

interface PlateRichTextEditorProps {
  content: string;
  onChange: (html: string, json?: any) => void;
  placeholder?: string;
  userId: string;
}

export function PlateRichTextEditor({
  content,
  onChange,
  placeholder = "Write something...",
  userId
}: PlateRichTextEditorProps) {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: [], // Initial value, will be set by useEffect
  });

  // Helper for deserialization
  const deserialize = React.useCallback((html: string) => {
    if (!html) return [{ type: 'p', children: [{ text: '' }] }];
    const editorNode = getEditorDOMFromHtmlString(html);
    return editor.api.html.deserialize({
      element: editorNode,
    });
  }, [editor]);

  // Initial deserialization
  React.useEffect(() => {
    const isEditorEmpty = 
      editor.children.length === 0 || 
      (editor.children.length === 1 && 
       (editor.children[0] as any)?.type === 'p' && 
       (editor.children[0] as any)?.children?.[0]?.text === '');

    if (content && isEditorEmpty) {
      const nodes = deserialize(content);
      editor.tf.setValue(nodes as any);
    }
  }, [content, editor, deserialize]);

  const handleUpdate = async () => {
    const json = editor.children;
    
    // Create a static editor for serialization to avoid side effects
    const editorStatic = createSlateEditor({
      plugins: BaseEditorKit,
      value: json,
    });

    const html = await serializeHtml(editorStatic, {
      editorComponent: EditorStatic,
    });

    onChange(html, json);
  };

  return (
    <div className="border rounded-md w-full overflow-hidden bg-card">
      <div className="outline-none m-0 p-0 relative">
        <Plate 
          editor={editor} 
          onValueChange={handleUpdate}
        >
          <FixedToolbar>
            <FixedToolbarButtons />
          </FixedToolbar>

          <EditorContainer>
            <Editor 
              variant="default" 
              placeholder={placeholder}
              className="min-h-[400px] max-h-[700px]"
            />
          </EditorContainer>

          <FloatingToolbar>
            <FloatingToolbarButtons />
          </FloatingToolbar>
        </Plate>
      </div>
    </div>
  );
}
