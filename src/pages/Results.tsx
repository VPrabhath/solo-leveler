import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, TrendingDown, RotateCcw, User, ChevronRight, Clock, Cpu, HardDrive } from 'lucide-react';

interface ParticipantResult {
  player_id: string;
  username: string;
  score: number;
  problems_solved: number;
  rank: number;
  avg_execution_ms: number;
  submission_count: number;
}

const Results = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<{ rank: number; score: number; problems_solved: number; total_players: number; elo_change: number } | null>(null);
  const [standings, setStandings] = useState<ParticipantResult[]>([]);
  const [showElo, setShowElo] = useState(false);
  const [eloUpdated, setEloUpdated] = useState(false);

  useEffect(() => {
    if (!matchId || !user) return;
    const fetchResults = async () => {
      const { data: participants } = await supabase
        .from('match_participants').select('*')
        .eq('match_id', matchId).order('score', { ascending: false });
      if (!participants) return;

      const playerIds = participants.map(p => p.player_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, username').in('user_id', playerIds);
      const nameMap = new Map(profiles?.map(p => [p.user_id, p.username]) || []);

      // Fetch submission stats per player
      const { data: submissions } = await supabase
        .from('submissions')
        .select('player_id, execution_time_ms')
        .eq('match_id', matchId);

      const execMap = new Map<string, { total: number; count: number }>();
      (submissions || []).forEach(s => {
        const existing = execMap.get(s.player_id) || { total: 0, count: 0 };
        existing.total += (s.execution_time_ms || 0);
        existing.count += 1;
        execMap.set(s.player_id, existing);
      });

      const sorted = participants.map((p, i) => {
        const exec = execMap.get(p.player_id);
        return {
          player_id: p.player_id,
          username: nameMap.get(p.player_id) || 'Unknown',
          score: p.score,
          problems_solved: p.problems_solved,
          rank: i + 1,
          avg_execution_ms: exec ? Math.round(exec.total / exec.count) : 0,
          submission_count: exec?.count || 0,
        };
      });
      setStandings(sorted);

      const myResult = sorted.find(s => s.player_id === user.id);
      if (myResult) {
        // The finish-match edge function now handles ELO updates on match completion.
        // We just calculate the display change for UI excitement.
        const eloChange = myResult.rank === 1 ? 25 : myResult.rank <= Math.ceil(sorted.length / 2) ? 10 : -10;
        setResult({ rank: myResult.rank, score: myResult.score, problems_solved: myResult.problems_solved, total_players: sorted.length, elo_change: eloChange });
      }
      setTimeout(() => setShowElo(true), 1500);
    };
    fetchResults();
  }, [matchId, user]);

  if (!result) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-primary font-heading text-xl animate-pulse">CALCULATING RESULTS...</div></div>;
  }

  const rankSuffix = (n: number) => n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';

  return (
    <div className="min-h-screen bg-background cyber-grid animate-grid-scroll">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.4 }} className="text-center mb-12">
          <div className="text-7xl mb-4">{result.rank === 1 ? '🏆' : result.rank <= 3 ? '🥇' : '⚔️'}</div>
          <h1 className="font-heading text-5xl text-foreground mb-2">{result.rank}{rankSuffix(result.rank)} <span className="text-primary text-glow-cyan">PLACE</span></h1>
          <p className="text-muted-foreground font-body text-lg">{result.score} points • {result.problems_solved} problems solved</p>
        </motion.div>

        <AnimatePresence>
          {showElo && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
              <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg border ${result.elo_change >= 0 ? 'bg-neon-green/10 border-neon-green/30' : 'bg-neon-red/10 border-neon-red/30'}`}>
                {result.elo_change >= 0 ? <TrendingUp className="w-5 h-5 text-neon-green" /> : <TrendingDown className="w-5 h-5 text-neon-red" />}
                <span className={`font-heading text-2xl ${result.elo_change >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                  {result.elo_change > 0 ? '+' : ''}{result.elo_change} ELO
                </span>
              </div>
              <p className="text-muted-foreground font-body text-sm mt-2">New rating: {(profile?.elo_rating || 1200)}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Standings with performance metrics */}
        <div className="bg-card/50 border border-border rounded-lg p-6 mb-8">
          <h2 className="font-heading text-sm text-muted-foreground mb-4 flex items-center gap-2"><Trophy className="w-4 h-4" /> FINAL STANDINGS</h2>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 text-muted-foreground font-heading text-xs mb-2">
            <span className="w-32">PLAYER</span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-center flex items-center gap-1"><Cpu className="w-3 h-3" /> AVG MS</span>
              <span className="w-12 text-center">SOLVED</span>
              <span className="w-16 text-center">SCORE</span>
            </div>
          </div>

          <div className="space-y-2">
            {standings.map((s, i) => (
              <motion.div key={s.player_id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className={`flex items-center justify-between px-4 py-3 rounded-lg ${s.player_id === user?.id ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'}`}>
                <div className="flex items-center gap-3 w-32">
                  <span className={`font-heading text-lg w-8 ${i === 0 ? 'text-neon-yellow' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>#{s.rank}</span>
                  <div>
                    <span className="font-body text-foreground text-sm">{s.username}</span>
                    {s.player_id === user?.id && <span className="text-xs text-primary font-heading ml-1">(YOU)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-6 font-mono text-sm">
                  <span className="w-16 text-center text-neon-cyan">{s.avg_execution_ms}ms</span>
                  <span className="w-12 text-center text-muted-foreground">{s.problems_solved}</span>
                  <span className="w-16 text-center text-primary font-bold">{s.score}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button onClick={() => navigate('/lobby')} className="font-heading tracking-wider glow-cyan h-12 px-8">
            <RotateCcw className="w-4 h-4 mr-2" /> QUEUE AGAIN
          </Button>
          <Button variant="outline" onClick={() => navigate('/profile')} className="font-heading tracking-wider h-12 px-8">
            VIEW PROFILE <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Results;
