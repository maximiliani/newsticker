import IgFeed from "@/components/feeds/IgFeed";
import { ResizableHandle } from "@/components/ui/resizable";
import { ResizablePanel } from "@/components/ui/resizable";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import ArticleFeed from "@/components/feeds/ArticleFeed";
import { CalendarFilter } from "@/components/CalendarFilter";
import { SneakPeek } from "@/components/SneakPeek";

export default function Home({ searchParams }: { searchParams: Promise<{ from?: string, to?: string }> }) {

  return (
    <main className="w-full h-[calc(100vh-10rem)] overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel 
          defaultSize={45}
          minSize={30}
          maxSize={70}
        >
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={60}>
              <ArticleFeed searchParams={searchParams} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40}>
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={50}>
                  <CalendarFilter />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50}>
                  <SneakPeek />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel 
          defaultSize={55}
          minSize={30}
          maxSize={70}
        >
          <IgFeed />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}