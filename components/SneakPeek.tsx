import {createClient} from "@/lib/supabase/server";
import {format} from "date-fns";

export async function SneakPeek() {
    const supabase = await createClient();
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const {data: events} = await supabase
        .from('calendar_events')
        .select('id, event_start, articles(id, title)')
        .gte('event_start', now.toISOString())
        .lte('event_start', nextWeek.toISOString())
        .order('event_start', {ascending: true})
        .limit(10);

    return (
        <div className="p-2 h-full overflow-hidden flex flex-col">
            <h3 className="font-semibold mb-2">Upcoming Events</h3>
            <div className="flex-1 overflow-auto space-y-3">
                {!events || events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming events.</p>
                ) : (
                    events.map((event: any) => (
                        <a href={`/news/${event.articles?.id}`} key={event.id}
                           className="text-sm border-l-2 border-primary pl-3 py-1">
                            <div>
                                <div className="font-medium truncate">{event.articles?.title || 'Untitled'}</div>
                                <div className="text-xs text-muted-foreground">
                                    {format(new Date(event.event_start), 'MMM d, HH:mm')}
                                </div>
                            </div>
                        </a>
                    ))
                )}
            </div>
        </div>
    );
}
