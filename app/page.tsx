import IgFeed from "@/components/feeds/IgFeed";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import ArticleFeed from "@/components/feeds/ArticleFeed";
import {CalendarFilter} from "@/components/CalendarFilter";
import {SneakPeek} from "@/components/SneakPeek";
import {Separator} from "@/components/ui/separator";

export default function Home({searchParams}: { searchParams: Promise<{ from?: string, to?: string }> }) {

    return (
        <main className="w-full h-[calc(100vh-10rem)] overflow-hidden">
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel
                    defaultSize={45}
                    minSize={30}
                    maxSize={70}
                >
                    <ResizablePanelGroup orientation="vertical">
                        <ResizablePanel defaultSize={60}>
                            <ArticleFeed searchParams={searchParams}/>
                        </ResizablePanel>
                        <ResizableHandle withHandle/>
                        <ResizablePanel defaultSize={40}>
                            <div className="flex gap-2">
                            <CalendarFilter/>
                            <Separator orientation="vertical"/>
                            <SneakPeek/>
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>

                <ResizableHandle/>

                <ResizablePanel
                    defaultSize={55}
                    minSize={30}
                    maxSize={80}
                >
                    <IgFeed/>
                </ResizablePanel>
            </ResizablePanelGroup>
        </main>
    );
}