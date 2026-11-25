ALTER POLICY "Admins can manage all articles" ON public.articles
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

ALTER POLICY "Allow authenticated users to insert their own articles" ON public.articles
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Allow users to delete their own articles" ON public.articles
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Allow users to update their own articles" ON public.articles
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Admins can manage all accounts" ON public.instagram_accounts
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

ALTER POLICY "Users can manage their own accounts" ON public.instagram_accounts
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Admins can manage all posts" ON public.instagram_posts
  USING (public.is_admin((SELECT auth.uid())));

ALTER POLICY "Users can manage their own posts" ON public.instagram_posts
  USING (EXISTS (
    SELECT 1 FROM public.instagram_accounts
    WHERE instagram_accounts.id = instagram_posts.user_id
      AND instagram_accounts.user_id = (SELECT auth.uid())
  ));

ALTER POLICY "Admins can manage all media" ON public.instagram_post_media
  USING (public.is_admin((SELECT auth.uid())));

ALTER POLICY "Users can manage their own media" ON public.instagram_post_media
  USING (EXISTS (
    SELECT 1
    FROM public.instagram_posts
    JOIN public.instagram_accounts ON instagram_posts.user_id = instagram_accounts.id
    WHERE instagram_post_media.post_id = instagram_posts.id
      AND instagram_accounts.user_id = (SELECT auth.uid())
  ));