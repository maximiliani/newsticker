"use client";
import IgFeed from "@/components/feeds/IgFeed";
import { ResizableHandle } from "@/components/ui/resizable";
import { ResizablePanel } from "@/components/ui/resizable";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import { useEffect, useState } from "react";
import ArticleFeed from "@/components/feeds/ArticleFeed";

export default function Home() {
  const [size, setSize] = useState<number>(typeof window !== 'undefined' && window.innerWidth >= 1280 ? 40 : 30);

  useEffect(() => {
    const handleResize = () => {
      setSize(window.innerWidth >= 1280 ? 40 : 30)
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <main className="w-full h-[calc(100vh-10rem)] overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel 
          defaultSize={30}
          minSize={20}
          maxSize={80}
        >
          <ArticleFeed />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel 
          defaultSize={70}
          minSize={20}
          maxSize={80}
        >
          <IgFeed />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}