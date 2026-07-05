'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { enUS, de } from 'date-fns/locale';
import { useLocale } from 'next-intl';

export function CalendarFilter() {
  const locale = useLocale();
  const dateLocale = locale === 'de' ? de : enUS;
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    if (from && to) {
      // Use UTC to avoid timezone issues when parsing from URL
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        return { from: fromDate, to: toDate };
      }
    }
    
    // Default to current week (Monday to Sunday)
    const now = new Date();
    return {
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: endOfWeek(now, { weekStartsOn: 1 })
    };
  });

  const handleSelect = (newRange: DateRange | undefined) => {
    setRange(newRange);
    
    const params = new URLSearchParams(searchParams.toString());
    if (newRange?.from) {
      params.set('from', format(newRange.from, 'yyyy-MM-dd'));
    } else {
      params.delete('from');
    }
    
    if (newRange?.to) {
      params.set('to', format(newRange.to, 'yyyy-MM-dd'));
    } else {
      params.delete('to');
    }
    
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="p-2 rounded-b-lg rounded-t-none h-full overflow-hidden flex flex-col justify-start items-center">
      {/*<h3 className="font-semibold mb-2">Filter by Date</h3>*/}
      {/*<div className="flex-1 overflow-auto flex justify-center">*/}
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleSelect}
            showWeekNumber
            locale={dateLocale}
            className="rounded-md border"
          />
      {/*</div>*/}
    </div>
  );
}
