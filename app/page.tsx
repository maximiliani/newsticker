import { ArticleFeed } from "@/components/feeds/ArticleFeed";
import IgFeed from "@/components/feeds/IgFeed";
import { ResizableHandle } from "@/components/ui/resizable";
import { ResizablePanel } from "@/components/ui/resizable";
import { ResizablePanelGroup } from "@/components/ui/resizable";

export default function Home() {
  return (<main className="w-full h-[calc(100vh-10rem)] overflow-hidden">
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel className="p-5">
        <ArticleFeed />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="p-5">
        <IgFeed />
      </ResizablePanel>
    </ResizablePanelGroup>
  </main>
  );
}
