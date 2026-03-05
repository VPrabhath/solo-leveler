
-- Fix overly permissive matches policies
DROP POLICY "Authenticated can create matches" ON public.matches;
DROP POLICY "Authenticated can update matches" ON public.matches;

-- Only admins or match system can create/update matches
CREATE POLICY "Admins can create matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update matches" ON public.matches FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix match_participants insert - allow authenticated users to join
DROP POLICY "Users can join matches" ON public.match_participants;
CREATE POLICY "Users can join matches" ON public.match_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);
