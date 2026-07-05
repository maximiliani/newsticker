import IgFeed from "@/components/feeds/IgFeed";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import ArticleFeed from "@/components/feeds/ArticleFeed";
import {CalendarFilter} from "@/components/CalendarFilter";
import {SneakPeek} from "@/components/SneakPeek";
import {Separator} from "@/components/ui/separator";

export default function Home({searchParams}: { searchParams: Promise<{ from?: string, to?: string }> }) {

    return (
        <main className="w-full h-[calc(100vh-8rem)] overflow-hidden">
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel
                    defaultSize={45}
                    minSize={20}
                    maxSize={80}
                    className="min-w-0 overflow-hidden flex flex-col"
                >
                    <ResizablePanelGroup orientation="vertical" className="flex-1 min-h-0">
                        <ResizablePanel defaultSize={60} className="min-w-0 overflow-hidden flex flex-col">
                            <ArticleFeed searchParams={searchParams}/>
                        </ResizablePanel>
                        <ResizableHandle withHandle/>
                        <ResizablePanel defaultSize={40} className="min-w-0 overflow-hidden flex flex-col">
                            <div className="flex h-full gap-2 overflow-hidden p-2 min-w-0">
                                <div className="flex-none">
                                    <CalendarFilter/>
                                </div>
                                <Separator orientation="vertical"/>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <SneakPeek searchParams={searchParams}/>
                                </div>
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
                <ResizableHandle withHandle/>

                <ResizablePanel
                    defaultSize={55}
                    minSize={20}
                    maxSize={80}
                    className="min-w-0 overflow-hidden flex flex-col"
                >
                    <IgFeed/>
                </ResizablePanel>
            </ResizablePanelGroup>
        </main>
    );
}