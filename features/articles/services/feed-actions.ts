"use server";

import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { ARTICLE_PAGE_SIZE, FeedArticle } from './feed-types';
import { DEFAULT_TIMEZONE, isValidTimezone } from '@/i18n/config';
import { isoToZonedLocal, zonedLocalToIso } from '@/lib/utils/event-datetime';

interface Row {
    id: string;
    title: string;
    description: string;
    created_at: string;
    modified_at: string;
    sort_at: string;
    event_datetime: string | null;
    event_all_day: boolean | null;
    author_name: string | null;
    author_avatar: string | null;
}

/**
 * Loads one page of visible articles, oldest first by event datetime
 * (falling back to creation time for non-calendar articles).
 */
export async function loadArticlePage(offset: number, from?: string, to?: string, limit = ARTICLE_PAGE_SIZE): Promise<FeedArticle[]> {
    const supabase = await createClient();
    const tc = await getTranslations('Common');
    const now = new Date();

    let query = supabase
        .from('articles_with_author_info')
        .select('id, title, description, created_at, modified_at, sort_at, visibility_from, visibility_to, event_datetime, event_all_day, author_name, author_avatar');

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
        .order('sort_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Supabase error:', error);
        throw new Error('Failed to load articles');
    }

    return (data as Row[] | null ?? [])
        .map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            createdAt: new Date(a.created_at),
            modifiedAt: new Date(a.modified_at),
            sortAt: new Date(a.sort_at),
            eventDatetime: a.event_datetime ? new Date(a.event_datetime) : null,
            eventAllDay: a.event_all_day ?? false,
            author: {
                name: a.author_name || tc('anonymous'),
                avatar: a.author_avatar || undefined,
            },
        }));
}

/** Start close to today, leaving a couple of earlier articles available for context. */
export async function loadInitialArticlePage(from?: string, to?: string): Promise<{ articles: FeedArticle[]; offset: number; timezone: string; today: string }> {
    const supabase = await createClient();
    const now = new Date();
    const { data: setting, error: timezoneError } = await supabase
        .from('app_settings').select('value').eq('key', 'default_timezone').maybeSingle();
    if (timezoneError) {
        console.error('Failed to load default timezone:', timezoneError);
        throw new Error('Failed to load default timezone');
    }
    const timezone = isValidTimezone(setting?.value) ? setting.value : DEFAULT_TIMEZONE;
    const today = isoToZonedLocal(now.toISOString(), timezone).slice(0, 10);
    const localStart = zonedLocalToIso(`${today}T00:00`, timezone)!;
    const utcStart = `${today}T00:00:00.000Z`;
    const start = localStart < utcStart ? localStart : utcStart;

    let query = supabase.from('articles_with_author_info')
        .select('id', { count: 'exact', head: true })
        .lt('sort_at', start);
    if (from && to) {
        const rangeStart = new Date(from);
        const rangeEnd = new Date(to);
        rangeEnd.setHours(23, 59, 59, 999);
        query = query.lte('visibility_from', rangeEnd.toISOString())
            .or(`visibility_to.is.null,visibility_to.gte.${rangeStart.toISOString()}`);
    } else {
        query = query.lte('visibility_from', now.toISOString())
            .or(`visibility_to.is.null,visibility_to.gte.${now.toISOString()}`);
    }
    const { count, error } = await query;
    if (error || count === null) {
        console.error('Failed to locate today in article feed:', error);
        throw new Error('Failed to locate today in article feed');
    }
    let offset = Math.max(0, count - 2);
    let articles = await loadArticlePage(offset, from, to);
    while (articles.length === 0 && offset > 0) {
        offset = Math.max(0, offset - ARTICLE_PAGE_SIZE);
        articles = await loadArticlePage(offset, from, to);
    }
    return { articles, offset, timezone, today };
}
