"use client";
import { ArticleFeed } from "@/components/feeds/ArticleFeed";
import IgFeed from "@/components/feeds/IgFeed";
import { ResizableHandle } from "@/components/ui/resizable";
import { ResizablePanel } from "@/components/ui/resizable";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import { useEffect, useState } from "react";

export default function Home() {
  const [size, setSize] = useState<number[]>(typeof window !== 'undefined' && window.innerWidth >= 1280 ? [50, 50] : [30, 70]);

  useEffect(() => {
    const handleResize = () => {
      setSize(window.innerWidth >= 1280 ? [50, 50] : [25, 75]);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <main className="w-full h-[calc(100vh-10rem)] overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel className="p-4" defaultSize={size[0]}>
          <ArticleFeed />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel className="p-4" defaultSize={size[1]}>
          <IgFeed />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
