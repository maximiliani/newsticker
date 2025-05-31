import IgFeed from "@/components/feeds/IgFeed";
import { ResizableHandle } from "@/components/ui/resizable";
import { ResizablePanel } from "@/components/ui/resizable";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import ArticleFeed from "@/components/feeds/ArticleFeed";

export default function Home() {
  return (
    <main className="w-full h-[calc(100vh-10rem)] overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel 
          defaultSize={35}
          minSize={30}
          maxSize={70}
        >
          <ArticleFeed />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel 
          defaultSize={65}
          minSize={30}
          maxSize={70}
        >
          <IgFeed />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}