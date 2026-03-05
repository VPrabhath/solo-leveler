import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { action } = await req.json()

    if (action === 'find_match') {
      // Check if user already in a waiting/countdown/in_progress match
      const { data: existingParticipation } = await supabase
        .from('match_participants')
        .select('match_id, matches!match_participants_match_id_fkey(status, start_time, time_limit_minutes)')
        .eq('player_id', user.id)

      const activeMatch = existingParticipation?.find((p: any) => {
        const match = p.matches as any;
        if (!['waiting', 'countdown', 'in_progress'].includes(match?.status)) return false;

        // If it's in progress, check if it's expired
        if (match.status === 'in_progress' && match.start_time) {
          const startTime = new Date(match.start_time).getTime();
          const limitMs = (match.time_limit_minutes || 10) * 60 * 1000;
          if (Date.now() - startTime > limitMs) return false;
        }
        return true;
      })

      if (activeMatch) {
        return new Response(JSON.stringify({ match_id: activeMatch.match_id, status: 'already_joined' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Use service role for match management
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      // Get recent opponents to avoid consecutive matches
      const { data: recentMatches } = await supabaseAdmin
        .from('match_participants')
        .select('match_id')
        .eq('player_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(3);

      let recentOpponentIds: string[] = [];
      if (recentMatches && recentMatches.length > 0) {
        const matchIds = recentMatches.map((m: any) => m.match_id);
        const { data: opponents } = await supabaseAdmin
          .from('match_participants')
          .select('player_id')
          .in('match_id', matchIds)
          .neq('player_id', user.id);

        if (opponents) {
          recentOpponentIds = opponents.map((o: any) => o.player_id);
        }
      }

      // Check if any other players are currently online
      const now = new Date()
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000)

      const { data: activeProfiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .gt('updated_at', thirtySecondsAgo.toISOString())
        .neq('user_id', user.id);

      const eligibleProfiles = (activeProfiles || []).filter((p: any) => !recentOpponentIds.includes(p.user_id));

      if (!activeProfiles || activeProfiles.length === 0) {
        return new Response(JSON.stringify({ status: 'no_players_online' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (eligibleProfiles.length === 0) {
        return new Response(JSON.stringify({ status: 'no_new_opponents' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Find an existing waiting match with room
      const { data: waitingMatches } = await supabaseAdmin
        .from('matches')
        .select('id, max_players, problem_ids')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
        .limit(5)

      let matchId: string | null = null

      for (const match of (waitingMatches || [])) {
        // Get participants and their last seen status
        const { data: participants } = await supabaseAdmin
          .from('match_participants')
          .select('player_id, profiles(updated_at)')
          .eq('match_id', match.id);

        const onlineEligibleParticipants = (participants || []).filter((p: any) => {
          const updatedAt = new Date(p.profiles?.updated_at || 0);
          const isOnline = updatedAt > thirtySecondsAgo;
          const isEligible = !recentOpponentIds.includes(p.player_id);
          return isOnline && isEligible;
        });

        // Clean up offline participants from waiting match
        const offlineParticipantIds = (participants || [])
          .filter((p: any) => {
            const updatedAt = new Date(p.profiles?.updated_at || 0);
            return updatedAt <= thirtySecondsAgo;
          })
          .map((p: any) => p.player_id);

        if (offlineParticipantIds.length > 0) {
          await supabaseAdmin
            .from('match_participants')
            .delete()
            .eq('match_id', match.id)
            .in('player_id', offlineParticipantIds);
        }

        if (onlineEligibleParticipants.length < match.max_players && onlineEligibleParticipants.length > 0) {
          matchId = match.id;
          break;
        }
      }

      // No waiting match found, create one with random problems
      if (!matchId) {
        // Get random problems: 2 easy, 2 medium, 1 hard
        const { data: easyProblems } = await supabaseAdmin
          .from('problems')
          .select('id')
          .eq('difficulty', 'easy')
          .eq('is_active', true)

        const { data: mediumProblems } = await supabaseAdmin
          .from('problems')
          .select('id')
          .eq('difficulty', 'medium')
          .eq('is_active', true)

        const { data: hardProblems } = await supabaseAdmin
          .from('problems')
          .select('id')
          .eq('difficulty', 'hard')
          .eq('is_active', true)

        const shuffle = <T,>(arr: T[]): T[] => arr.sort(() => Math.random() - 0.5)

        const selectedEasy = shuffle(easyProblems || []).slice(0, 2).map((p: any) => p.id)
        const selectedMedium = shuffle(mediumProblems || []).slice(0, 2).map((p: any) => p.id)
        const selectedHard = shuffle(hardProblems || []).slice(0, 1).map((p: any) => p.id)

        const problemIds = [...selectedEasy, ...selectedMedium, ...selectedHard]

        if (problemIds.length < 1) {
          return new Response(JSON.stringify({ error: 'Not enough problems in the database to create a match.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: newMatch, error: matchError } = await supabaseAdmin
          .from('matches')
          .insert({
            problem_ids: problemIds,
            max_players: 8,
            time_limit_minutes: 10,
            status: 'waiting',
          })
          .select('id')
          .single()

        if (matchError || !newMatch) {
          return new Response(JSON.stringify({ error: 'Failed to create match: ' + (matchError?.message || 'unknown') }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        matchId = newMatch.id
      }

      // Join the match
      const { error: joinError } = await supabaseAdmin
        .from('match_participants')
        .insert({ match_id: matchId, player_id: user.id })

      if (joinError && !joinError.message.includes('duplicate')) {
        return new Response(JSON.stringify({ error: 'Failed to join: ' + joinError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Check participant count (online only) — if >= 2, start countdown
      const { data: currentParticipants } = await supabaseAdmin
        .from('match_participants')
        .select('player_id, profiles(updated_at)')
        .eq('match_id', matchId);

      const onlineCount = (currentParticipants || []).filter((p: any) => {
        const updatedAt = new Date(p.profiles?.updated_at || 0);
        return updatedAt > thirtySecondsAgo;
      }).length;

      if (onlineCount >= 2) {
        // Start countdown, then auto-transition to in_progress
        await supabaseAdmin
          .from('matches')
          .update({ status: 'countdown' })
          .eq('id', matchId)
          .eq('status', 'waiting')

        // Schedule match start after 5 seconds
        setTimeout(async () => {
          await supabaseAdmin
            .from('matches')
            .update({ status: 'in_progress', start_time: new Date().toISOString() })
            .eq('id', matchId)
            .eq('status', 'countdown')
        }, 5000)
      }

      return new Response(JSON.stringify({ match_id: matchId, status: 'joined', player_count: onlineCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
