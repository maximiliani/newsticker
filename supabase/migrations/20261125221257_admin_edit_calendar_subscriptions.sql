CREATE POLICY "Admins can view calendar subscriptions"
  ON public.calendar_subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT public.check_is_admin()));

CREATE POLICY "Admins can update calendar subscriptions"
  ON public.calendar_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.check_is_admin()))
  WITH CHECK ((SELECT public.check_is_admin()));

CREATE POLICY "Admins can delete calendar subscriptions"
  ON public.calendar_subscriptions
  FOR DELETE
  TO authenticated
  USING ((SELECT public.check_is_admin()));