"use server";

import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { ARTICLE_PAGE_SIZE, FeedArticle } from './feed-types';

interface Row {
    id: string;
    title: string;
    description: string;
    created_at: string;
    modified_at: string;
    event_datetime: string | null;
    event_all_day: boolean | null;
    author_name: string | null;
    author_avatar: string | null;
}

/**
 * Loads one page of visible articles, newest first by event datetime
 * (falling back to creation time for non-calendar articles).
 */
export async function loadArticlePage(offset: number, from?: string, to?: string): Promise<FeedArticle[]> {
    const supabase = await createClient();
    const tc = await getTranslations('Common');
    const now = new Date();

    let query = supabase
        .from('articles_with_author_info')
        .select('id, title, description, created_at, modified_at, visibility_from, visibility_to, event_datetime, event_all_day, author_name, author_avatar');

    if (from && to) {
        const rangeStart = new Date(from);
        const rangeEnd = new Date(to);
        rangeEnd.setHours(23, 59, 59, 999);
        query = query
            .lte('visibility_from', rangeEnd.toISOString())
            .or(`visibility_to.is.null,visibility_to.gte.${rangeStart.toISOString()}`);
    } else {
        query = query
            .lte('visibility_from', now.toISOString())
            .or(`visibility_to.is.null,visibility_to.gte.${now.toISOString()}`);
    }

    const { data, error } = await query
        .order('sort_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + ARTICLE_PAGE_SIZE - 1);

    if (error) {
        console.error('Supabase error:', error);
        return [];
    }

    return (data as Row[] | null ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        createdAt: new Date(a.created_at),
        modifiedAt: new Date(a.modified_at),
        eventDatetime: a.event_datetime ? new Date(a.event_datetime) : null,
        eventAllDay: a.event_all_day ?? false,
        author: {
            name: a.author_name || tc('anonymous'),
            avatar: a.author_avatar || undefined,
        },
    }));
}
