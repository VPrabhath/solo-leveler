-- Allow players to delete their own participation (cancel search)
CREATE POLICY "Users can cancel own participation"
ON public.match_participants
FOR DELETE
USING (auth.uid() = player_id);

-- Allow match status to be updated by participants (for finishing matches)
CREATE POLICY "Participants can update match status"
ON public.matches
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_participants.match_id = matches.id
    AND match_participants.player_id = auth.uid()
  )
);