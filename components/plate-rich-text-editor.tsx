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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CodeIcon } from "lucide-react";
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
  const [editorMode, setEditorMode] = React.useState<'wysiwyg' | 'code'>('wysiwyg');
  const [htmlCode, setHtmlCode] = React.useState(content);

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

  // Update htmlCode when the content prop changes externally, but only if it's different
  React.useEffect(() => {
    if (content !== htmlCode) {
      setHtmlCode(content);
    }
  }, [content, htmlCode]);

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

    if (html !== htmlCode) {
      setHtmlCode(html);
      onChange(html, json);
    }
  };

  // When switching back to WYSIWYG, push the code editor's HTML into Plate
  // We track the previous mode to only run this on transition
  const prevModeRef = React.useRef(editorMode);
  React.useEffect(() => {
    if (prevModeRef.current === 'code' && editorMode === 'wysiwyg') {
      const nodes = deserialize(htmlCode);
      editor.tf.setValue(nodes as any);
    }
    prevModeRef.current = editorMode;
  }, [editorMode, editor, htmlCode, deserialize]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newHtml = e.target.value;
    setHtmlCode(newHtml);
    onChange(newHtml);
  };

  return (
    <div className="border rounded-md w-full overflow-hidden bg-card">
      <Tabs defaultValue="wysiwyg" value={editorMode} onValueChange={(value) => setEditorMode(value as 'wysiwyg' | 'code')}>
        <div className="flex justify-between items-center p-2 border-b bg-muted/50">
          <TabsList>
            <TabsTrigger value="wysiwyg">WYSIWYG</TabsTrigger>
            <TabsTrigger value="code">HTML Code</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="wysiwyg" className="outline-none m-0 p-0 relative">
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
        </TabsContent>

        <TabsContent value="code" className="outline-none m-0 p-0">
          <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                try {
                  const formatted = htmlCode
                    .replace(/></g, '>\n<')
                    .replace(/(<div>|<p>|<h[1-6]>|<ul>|<ol>|<li>|<table>|<tr>|<td>)/g, '\n$1')
                    .replace(/\n\s+/g, '\n');
                  setHtmlCode(formatted);
                } catch (error) {
                  console.error('Error formatting HTML:', error);
                }
              }}
              title="Format HTML"
            >
              <CodeIcon className="h-4 w-4 mr-2" />
              Format HTML
            </Button>
          </div>
          <Textarea
            value={htmlCode}
            onChange={handleCodeChange}
            className="w-full min-h-[400px] p-4 font-mono text-sm border-none rounded-none focus-visible:ring-0 resize-none"
            placeholder="Enter HTML code here..."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
