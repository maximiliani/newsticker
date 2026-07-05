import {createClient} from "@/lib/supabase/server";
import {format} from "date-fns";

export async function SneakPeek({ searchParams }: { searchParams: Promise<{ from?: string, to?: string }> }) {
    const { from } = await searchParams;
    const supabase = await createClient();
    
    // Default to today if no 'from' date is provided
    let startDate = new Date();
    if (from) {
        const parsedFrom = new Date(from);
        if (!isNaN(parsedFrom.getTime())) {
            startDate = parsedFrom;
        }
    }
    
    // Show events for the next 14 days
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 14);

    const {data: events} = await supabase
        .from('calendar_events')
        .select(`
            id, 
            event_start, 
            articles(id, title),
            calendar_subscriptions(color)
        `)
        .gte('event_start', startDate.toISOString())
        .lte('event_start', endDate.toISOString())
        .order('event_start', {ascending: true})
        .limit(20);

    return (
        <div className="p-2 h-full overflow-hidden flex flex-col">
            <h3 className="font-semibold mb-2">Upcoming Events</h3>
            <div className="flex-1 overflow-auto">
                {!events || events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming events.</p>
                ) : (
                    events.map((event: any) => {
                        const subscriptionColor = event.calendar_subscriptions?.color || '#3B82F6';
                        return (
                            <a 
                                href={`/news/${event.articles?.id}`} 
                                key={event.id}
                                className="text-sm border-l-4 pl-3 py-1 block hover:bg-accent/50 rounded-r-md transition-colors"
                                style={{ borderLeftColor: subscriptionColor }}
                            >
                                <div>
                                    <div className="font-medium truncate">{event.articles?.title || 'Untitled'}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {format(new Date(event.event_start), 'MMM d, HH:mm')}
                                    </div>
                                </div>
                            </a>
                        );
                    })
                )}
            </div>
        </div>
    );
}
