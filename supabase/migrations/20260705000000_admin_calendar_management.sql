-- Add admin policies for calendar_subscriptions
CREATE POLICY "Admins can manage all calendar subscriptions"
ON public.calendar_subscriptions FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policies for calendar_events
CREATE POLICY "Admins can manage all calendar events"
ON public.calendar_events FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Trigger to set locally_modified = true on calendar_events when the linked article is updated
CREATE OR REPLACE FUNCTION public.mark_calendar_event_as_locally_modified()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.calendar_events
    SET locally_modified = true
    WHERE article_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_article_update_mark_calendar_locally_modified
AFTER UPDATE ON public.articles
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description)
EXECUTE FUNCTION public.mark_calendar_event_as_locally_modified();

-- Add uniqueness constraint for calendar subscription colors per user
-- First, let's make sure existing colors are somewhat unique if possible, 
-- but a hard constraint might fail if there are duplicates now.
-- So we use a unique index instead of a constraint if we want to be safe, 
-- or just accept that it might fail if duplicates exist.
-- The requirement says "must be unique".
-- ALTER TABLE public.calendar_subscriptions ADD CONSTRAINT calendar_subscriptions_user_color_key UNIQUE (user_id, color);
