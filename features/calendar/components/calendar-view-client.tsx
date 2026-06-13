'use client';

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import "react-day-picker/dist/style.css";

interface Props {
  initialArticles: any[];
}

export function CalendarViewClient({ initialArticles }: Props) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  
  // Articles with valid visibility dates
  const articles = initialArticles.filter(a => a.visibility_from && a.visibility_to);

  const modifiers = {
    hasArticle: (date: Date) => {
      return articles.some(a => {
        const from = new Date(a.visibility_from);
        const to = new Date(a.visibility_to);
        return isWithinInterval(date, { start: startOfDay(from), end: endOfDay(to) });
      });
    }
  };

  const selectedArticles = selectedDay ? articles.filter(a => {
    const from = new Date(a.visibility_from);
    const to = new Date(a.visibility_to);
    return isWithinInterval(selectedDay, { start: startOfDay(from), end: endOfDay(to) });
  }) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <Card className="p-4 shadow-none lg:w-fit h-fit border">
        <DayPicker
          mode="single"
          selected={selectedDay}
          onSelect={setSelectedDay}
          modifiers={modifiers}
          modifiersStyles={{
            hasArticle: { fontWeight: 'bold', textDecoration: 'underline' }
          }}
          className="mx-auto"
        />
      </Card>

      <div className="flex-1 space-y-4">
        <Card className="flex flex-col shadow-none border min-h-[500px]">
          <CardHeader>
            <CardTitle>
              {selectedDay ? format(selectedDay, 'PPPP') : 'Select a day'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <ScrollArea className="h-[600px] pr-4">
              {selectedArticles.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No articles visible on this day.</p>
              ) : (
                <div className="grid gap-4">
                  {selectedArticles.map(article => (
                    <div key={article.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{article.author_name}</Badge>
                        <span className="text-xs text-muted-foreground">{format(new Date(article.created_at), 'MMM d, p')}</span>
                      </div>
                      <h4 className="font-bold mb-1 text-lg">{article.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">{article.description}</p>
                      <a 
                        href={`/news/${article.id}`} 
                        className="text-primary text-sm font-medium mt-3 inline-flex items-center hover:underline"
                      >
                        Read more
                        <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
