ALTER POLICY "Users can view their own calendar events" ON public.calendar_events
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can manage their own calendar subscriptions" ON public.calendar_subscriptions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Admins can create deletion requests" ON public.user_deletion_requests
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.is_admin = true
  ));

ALTER POLICY "Admins can view deletion requests" ON public.user_deletion_requests
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.is_admin = true
  ));

ALTER POLICY "Admins can delete roles" ON public.user_roles
  USING (public.is_admin((SELECT auth.uid())));

ALTER POLICY "Admins can insert roles" ON public.user_roles
  WITH CHECK (public.is_admin((SELECT auth.uid())));

ALTER POLICY "Admins can update roles" ON public.user_roles
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

ALTER POLICY "Admins can view all roles" ON public.user_roles
  USING (public.is_admin((SELECT auth.uid())));

ALTER POLICY "Users can view their own role" ON public.user_roles
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can see their own data" ON public.users_secure
  USING (id = (SELECT auth.uid()));