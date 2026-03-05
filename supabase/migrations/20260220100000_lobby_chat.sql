
-- Lobby messages table for global chat
CREATE TABLE public.lobby_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.lobby_messages ENABLE ROW LEVEL SECURITY;

-- Everyone can see messages, but only owners can insert
CREATE POLICY "Messages are viewable by everyone" ON public.lobby_messages FOR SELECT USING (true);
CREATE POLICY "Users can insert own messages" ON public.lobby_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_messages;

-- Add a few more problems to ensure matchmaking has variety
INSERT INTO public.problems (title, description, difficulty, test_cases, time_limit_seconds) VALUES
('Palindrome Master', 'Write a function to check if a string is a palindrome. Ignore case and non-alphanumeric characters.', 'easy', '[{"input": "Racecar", "expected_output": true}, {"input": "Hello", "expected_output": false}, {"input": "A man, a plan, a canal: Panama", "expected_output": true}]'::jsonb, 5),
('Two Sum', 'Given an array of integers and a target, return indices of the two numbers that add up to the target.', 'easy', '[{"input": "[2,7,11,15], 9", "expected_output": "[0,1]"}, {"input": "[3,2,4], 6", "expected_output": "[1,2]"}]'::jsonb, 5),
('Longest Substring', 'Find the length of the longest substring without repeating characters.', 'medium', '[{"input": "abcabcbb", "expected_output": 3}, {"input": "bbbbb", "expected_output": 1}, {"input": "pwwkew", "expected_output": 3}]'::jsonb, 10);
