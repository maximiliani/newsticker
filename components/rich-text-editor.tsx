"use client";

import * as React from "react";
import { EditorContent, type Extension, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";

import { ImageExtension } from "@/components/tiptap/extensions/image";
import { ImagePlaceholder } from "@/components/tiptap/extensions/image-placeholder";
import SearchAndReplace from "@/components/tiptap/extensions/search-and-replace";
import { TipTapFloatingMenu } from "@/components/tiptap/extensions/floating-menu";
import { FloatingToolbar } from "@/components/tiptap/extensions/floating-toolbar";
import { EditorToolbar } from "@/components/tiptap/toolbars/editor-toolbar";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CodeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import "@/components/tiptap/tiptap.css";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string, json?: any) => void;
  placeholder?: string;
  userId: string;
}

const extensions = [
  StarterKit.configure({
    orderedList: {
      HTMLAttributes: {
        class: "list-decimal",
      },
    },
    bulletList: {
      HTMLAttributes: {
        class: "list-disc",
      },
    },
    heading: {
      levels: [1, 2, 3, 4],
    },
  }),
  Placeholder.configure({
    emptyNodeClass: "is-editor-empty",
    placeholder: ({ node }) => {
      switch (node.type.name) {
        case "heading":
          return `Heading ${node.attrs.level}`;
        case "detailsSummary":
          return "Section title";
        case "codeBlock":
          return "";
        default:
          return "Write something...";
      }
    },
    includeChildren: false,
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  TextStyle,
  Subscript,
  Superscript,
  Underline,
  Link.configure({
    openOnClick: false,
  }),
  Color,
  Highlight.configure({
    multicolor: true,
  }),
  ImageExtension,
  ImagePlaceholder,
  SearchAndReplace,
  Typography,
];

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Write something...",
  userId
}: RichTextEditorProps) {
  const [editorMode, setEditorMode] = React.useState<'wysiwyg' | 'code'>('wysiwyg');
  const [htmlCode, setHtmlCode] = React.useState(content);

  // Update htmlCode when the content prop changes externally
  React.useEffect(() => {
    setHtmlCode(content);
  }, [content]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: extensions as Extension[],
    content,
    editorProps: {
      attributes: {
        class: "max-w-full focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      onChange(html, json);
      setHtmlCode(html);
    },
  });

  // When switching back to WYSIWYG, push the code editor's HTML into Tiptap
  React.useEffect(() => {
    if (editorMode === 'wysiwyg' && editor && editor.getHTML() !== htmlCode) {
      editor.commands.setContent(htmlCode);
    }
  }, [editorMode, editor, htmlCode]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newHtml = e.target.value;
    setHtmlCode(newHtml);
    onChange(newHtml);
  };

  if (!editor) return null;

  return (
    <div className="border rounded-md w-full overflow-hidden bg-card">
      <Tabs defaultValue="wysiwyg" onValueChange={(value) => setEditorMode(value as 'wysiwyg' | 'code')}>
        <div className="flex justify-between items-center p-2 border-b bg-muted/50">
          <TabsList>
            <TabsTrigger value="wysiwyg">WYSIWYG</TabsTrigger>
            <TabsTrigger value="code">HTML Code</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="wysiwyg" className="outline-none m-0 p-0 relative">
          <div className="relative w-full overflow-hidden">
            <EditorToolbar editor={editor} />
            <FloatingToolbar editor={editor} />
            <TipTapFloatingMenu editor={editor} />
            <div className="min-h-[400px] max-h-[700px] overflow-y-auto custom-scrollbar">
              <EditorContent
                editor={editor}
                className="w-full min-w-full cursor-text p-4 sm:p-6"
              />
            </div>
          </div>
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
