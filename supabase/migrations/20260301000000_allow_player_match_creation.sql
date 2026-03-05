-- Allow any authenticated user to create a match
CREATE POLICY "Authenticated can create matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (true);
