"use client";

import { Button } from "@/components/ui/button";
import { ArticleVisibilityStatus } from "./ArticleInterfaceTypes";

interface FilterOption {
  value: ArticleVisibilityStatus;
  label: string;
}

interface ArticleFiltersProps {
  currentFilter: ArticleVisibilityStatus;
  onFilterChange: (filter: ArticleVisibilityStatus) => void;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Articles' },
  { value: 'current', label: 'Currently Visible' },
  { value: 'future', label: 'Scheduled' },
  { value: 'past', label: 'Past Articles' },
] as const;

export function ArticleFilters({ currentFilter, onFilterChange }: ArticleFiltersProps) {
  return (
    <div className="flex gap-2 mb-4" role="group" aria-label="Article filters">
      {FILTER_OPTIONS.map((filter) => (
        <Button
          key={filter.value}
          variant={currentFilter === filter.value ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange(filter.value)}
          aria-pressed={currentFilter === filter.value}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}