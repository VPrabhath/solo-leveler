// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Analyze code complexity based on patterns
function analyzeComplexity(code: string, language: string): { time_complexity: string; space_complexity: string; explanation: string } {
    const lines = code.split('\n')
    const cleanCode = language === 'python'
        ? code.replace(/#.*$/gm, '')
        : code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

    let maxNesting = 0
    let hasRecursion = false
    let hasSorting = false
    let hasHashMap = false
    let hasBinarySearch = false
    let hasExtraArrays = false

    // Detect function name for recursion check
    let funcName: string | undefined
    if (language === 'python') {
        const funcMatch = cleanCode.match(/def\s+(\w+)/)
        funcName = funcMatch?.[1]
    } else {
        const funcMatch = cleanCode.match(/function\s+(\w+)/)
        funcName = funcMatch?.[1]
    }

    // Count nested loops
    let currentNesting = 0
    for (const line of lines) {
        const trimmed = line.trim()
        if (language === 'python') {
            if (/^(for|while)\s/.test(trimmed)) {
                currentNesting++
                maxNesting = Math.max(maxNesting, currentNesting)
            }
        } else {
            if (/\b(for|while)\s*\(/.test(trimmed)) {
                currentNesting++
                maxNesting = Math.max(maxNesting, currentNesting)
            }
            if (trimmed.includes('}')) {
                currentNesting = Math.max(0, currentNesting - 1)
            }
        }
    }

    // Detect patterns
    if (funcName && cleanCode.includes(funcName + '(') && cleanCode.split(funcName + '(').length > 2) {
        hasRecursion = true
    }

    if (language === 'python') {
        if (/\.sort\s*\(|sorted\s*\(/.test(cleanCode)) hasSorting = true
        if (/dict\s*\(|\{\s*\}|defaultdict|Counter/.test(cleanCode)) hasHashMap = true
        if (/\/\/\s*2|bisect|binary_search/i.test(cleanCode)) hasBinarySearch = true
        if (/\[\s*\]|list\s*\(|\.append|\.extend/.test(cleanCode)) hasExtraArrays = true
    } else {
        if (/\.sort\s*\(/.test(cleanCode)) hasSorting = true
        if (/new\s+(Map|Set|Object)\s*\(/.test(cleanCode) || /\{\s*\}/.test(cleanCode) || /new\s+Map/.test(cleanCode)) hasHashMap = true
        if (/Math\.(floor|ceil).*\/\s*2/.test(cleanCode) || />>.*1/.test(cleanCode) || /binarySearch|binary_search/i.test(cleanCode)) hasBinarySearch = true
        if (/new\s+Array|Array\(|\[\s*\]|\.map\s*\(|\.filter\s*\(|\.slice\s*\(/.test(cleanCode)) hasExtraArrays = true
    }

    // Determine time complexity
    let timeComplexity = 'O(1)'
    let explanation = 'Constant time operations'

    if (hasBinarySearch) {
        timeComplexity = 'O(log n)'
        explanation = 'Binary search pattern detected'
    } else if (hasSorting && maxNesting <= 1) {
        timeComplexity = 'O(n log n)'
        explanation = 'Sorting dominates the time complexity'
    } else if (maxNesting === 1) {
        timeComplexity = 'O(n)'
        explanation = 'Single loop iteration'
    } else if (maxNesting === 2) {
        timeComplexity = 'O(n²)'
        explanation = 'Nested loops detected'
    } else if (maxNesting >= 3) {
        timeComplexity = 'O(n³)'
        explanation = `${maxNesting} levels of nested loops`
    }

    if (hasRecursion && timeComplexity === 'O(1)') {
        timeComplexity = 'O(2^n)'
        explanation = 'Recursive calls without memoization'
    }

    // Determine space complexity
    let spaceComplexity = 'O(1)'
    if (hasHashMap || hasExtraArrays) {
        spaceComplexity = 'O(n)'
    }
    if (hasRecursion) {
        spaceComplexity = spaceComplexity === 'O(1)' ? 'O(n)' : spaceComplexity
    }
    if (maxNesting >= 2 && hasExtraArrays) {
        spaceComplexity = 'O(n²)'
    }

    return { time_complexity: timeComplexity, space_complexity: spaceComplexity, explanation }
}

Deno.serve(async (req: any) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const { match_id } = await req.json()

        if (!match_id) {
            return new Response(JSON.stringify({ error: 'Missing match_id' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 1. Fetch match and participants
        const { data: match, error: matchError } = await supabaseAdmin
            .from('matches')
            .select('*')
            .eq('id', match_id)
            .single()

        if (matchError || !match) {
            return new Response(JSON.stringify({ error: 'Match not found' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (match.status === 'finished') {
            return new Response(JSON.stringify({ message: 'Match already finished' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const { data: participants, error: partError } = await supabaseAdmin
            .from('match_participants')
            .select('player_id, score, problems_solved')
            .eq('match_id', match_id)
            .order('score', { ascending: false })

        if (partError || !participants || participants.length === 0) {
            return new Response(JSON.stringify({ error: 'No participants found' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Identify winner(s)
        const maxScore = participants[0].score
        let winners = participants.filter((p: any) => p.score === maxScore)
        let winnerIds = winners.map((w: any) => w.player_id)

        // --- NEW TIE BREAKER LOGIC ---
        if (winners.length > 1 && maxScore > 0) {
            // Fetch accepted submissions for tied players
            const { data: submissions } = await supabaseAdmin
                .from('submissions')
                .select('player_id, code, language, execution_time_ms')
                .eq('match_id', match_id)
                .in('player_id', winnerIds)
                .eq('result', 'accepted')

            if (submissions && submissions.length > 0) {
                const playerStats = new Map<string, { complexityPenalty: number, executionTime: number, count: number }>()

                for (const sub of submissions) {
                    const complexity = analyzeComplexity(sub.code, sub.language)
                    let penalty = 0

                    // Assign penalty based on time complexity
                    if (complexity.time_complexity === 'O(1)') penalty += 1
                    else if (complexity.time_complexity === 'O(log n)') penalty += 2
                    else if (complexity.time_complexity === 'O(n)') penalty += 3
                    else if (complexity.time_complexity === 'O(n log n)') penalty += 4
                    else if (complexity.time_complexity === 'O(n²)') penalty += 5
                    else penalty += 6

                    // Assign penalty based on space complexity
                    if (complexity.space_complexity === 'O(1)') penalty += 1
                    else if (complexity.space_complexity === 'O(log n)') penalty += 2
                    else if (complexity.space_complexity === 'O(n)') penalty += 3
                    else if (complexity.space_complexity === 'O(n²)') penalty += 5
                    else penalty += 6

                    const stat = playerStats.get(sub.player_id) || { complexityPenalty: 0, executionTime: 0, count: 0 }
                    stat.complexityPenalty += penalty
                    stat.executionTime += (sub.execution_time_ms || 0)
                    stat.count += 1
                    playerStats.set(sub.player_id, stat)
                }

                // Calculate averages
                const averages = Array.from(playerStats.entries()).map(([playerId, stat]) => ({
                    playerId,
                    avgPenalty: stat.complexityPenalty / stat.count,
                    avgTime: stat.executionTime / stat.count
                }))

                // Sort by penalty (lower is better), then by run time (lower is better)
                averages.sort((a, b) => {
                    if (a.avgPenalty !== b.avgPenalty) return a.avgPenalty - b.avgPenalty
                    return a.avgTime - b.avgTime
                })

                if (averages.length > 0) {
                    const bestPlayer = averages[0]
                    const actualWinnerId = bestPlayer.playerId

                    // Remove other players from winners list
                    winners = winners.filter((w: any) => w.player_id === actualWinnerId)
                    winnerIds = [actualWinnerId]

                    // Give the sole winner a +1 score to break the tie in the DB
                    await supabaseAdmin
                        .from('match_participants')
                        .update({ score: maxScore + 1 })
                        .eq('match_id', match_id)
                        .eq('player_id', actualWinnerId)
                }
            }
        }

        // 3. Simple ELO calculation (K-factor = 32)
        // In a real app, this would use a proper formula vs opponent avg
        // Here we'll just give +25 to winners and -15 to others
        for (const p of participants) {
            const isWinner = winnerIds.includes(p.player_id)
            const eloChange = isWinner ? 25 : -15

            // Update profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('elo_rating, wins, total_matches')
                .eq('user_id', p.player_id)
                .single()

            if (profile) {
                await supabaseAdmin
                    .from('profiles')
                    .update({
                        elo_rating: Math.max(0, (profile.elo_rating || 1200) + eloChange),
                        wins: isWinner ? (profile.wins || 0) + 1 : (profile.wins || 0),
                        total_matches: (profile.total_matches || 0) + 1
                    })
                    .eq('user_id', p.player_id)
            }
        }

        // 4. Update match status
        await supabaseAdmin
            .from('matches')
            .update({
                status: 'finished',
                end_time: new Date().toISOString()
            })
            .eq('id', match_id)

        return new Response(JSON.stringify({ success: true, winner_ids: winnerIds }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
