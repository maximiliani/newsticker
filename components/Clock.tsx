"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/utils/utils";

export function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center px-6 py-2 rounded-lg shadow-lg">
      <time 
        className="text-xl font-bold tracking-wide flex items-center gap-2 motion-safe:after:w-2 motion-safe:after:h-2 motion-safe:after:rounded-full motion-safe:after:bg-red-500 motion-safe:after:animate-ping"
        dateTime={time.toISOString()}
      >
        {time.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}
      </time>
      <div className="text-sm text-muted-foreground">
        {time.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </div>
    </div>
  );
} 