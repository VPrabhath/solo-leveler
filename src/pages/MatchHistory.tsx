import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Swords, ArrowLeft, Trophy, Target, Flame, Clock, ChevronRight, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type MatchParticipant = Database['public']['Tables']['match_participants']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];

interface MatchHistoryEntry {
  participant: MatchParticipant;
  match: Match;
  opponent_count: number;
  is_win: boolean;
  is_draw: boolean;
}

const MatchHistory = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [stats, setStats] = useState({ total: 0, wins: 0, losses: 0, draws: 0, avgScore: 0, bestScore: 0 });

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setFetching(true);

      // Get all participations
      const { data: participations } = await supabase
        .from('match_participants')
        .select('*')
        .eq('player_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(50);

      if (!participations || participations.length === 0) {
        setFetching(false);
        return;
      }

      const matchIds = participations.map(p => p.match_id);

      // Get matches and all participants in parallel
      const [matchesRes, allParticipantsRes] = await Promise.all([
        supabase.from('matches').select('*').in('id', matchIds),
        supabase.from('match_participants').select('*').in('match_id', matchIds),
      ]);

      const matches = matchesRes.data || [];
      const allParticipants = allParticipantsRes.data || [];

      const matchMap = new Map(matches.map(m => [m.id, m]));

      const entries: MatchHistoryEntry[] = participations
        .map(p => {
          const match = matchMap.get(p.match_id);
          if (!match) return null;

          const matchParticipants = allParticipants.filter(ap => ap.match_id === p.match_id);
          const opponentCount = matchParticipants.length - 1;
          const isWin = p.rank === 1 && matchParticipants.length > 1;
          const isDraw = matchParticipants.length > 1 && matchParticipants.filter(ap => ap.score === p.score).length > 1 && p.rank === 1;

          return { participant: p, match, opponent_count: opponentCount, is_win: isWin, is_draw: isDraw };
        })
        .filter(Boolean) as MatchHistoryEntry[];

      setHistory(entries);

      // Calculate stats
      const finishedEntries = entries.filter(e => e.match.status === 'finished');
      const wins = finishedEntries.filter(e => e.is_win && !e.is_draw).length;
      const draws = finishedEntries.filter(e => e.is_draw).length;
      const losses = finishedEntries.length - wins - draws;
      const scores = finishedEntries.map(e => e.participant.score);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

      setStats({ total: finishedEntries.length, wins, losses, draws, avgScore, bestScore });
      setFetching(false);
    };
    fetchHistory();
  }, [user]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary font-heading text-xl animate-pulse">LOADING...</div>
      </div>
    );
  }

  const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

  const getStatusBadge = (match: Match) => {
    switch (match.status) {
      case 'finished':
        return <Badge className="bg-muted text-muted-foreground border-border font-heading text-[10px]">FINISHED</Badge>;
      case 'in_progress':
        return <Badge className="bg-neon-green/10 text-neon-green border-neon-green/30 font-heading text-[10px]">LIVE</Badge>;
      case 'waiting':
      case 'countdown':
        return <Badge className="bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30 font-heading text-[10px]">PENDING</Badge>;
      default:
        return null;
    }
  };

  const getResultIcon = (entry: MatchHistoryEntry) => {
    if (entry.match.status !== 'finished') return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (entry.is_draw) return <Minus className="w-4 h-4 text-neon-yellow" />;
    if (entry.is_win) return <TrendingUp className="w-4 h-4 text-neon-green" />;
    return <TrendingDown className="w-4 h-4 text-neon-red" />;
  };

  const getResultLabel = (entry: MatchHistoryEntry) => {
    if (entry.match.status !== 'finished') return 'In Progress';
    if (entry.is_draw) return 'Draw';
    if (entry.is_win) return 'Victory';
    return 'Defeat';
  };

  const getResultColor = (entry: MatchHistoryEntry) => {
    if (entry.match.status !== 'finished') return 'text-muted-foreground';
    if (entry.is_draw) return 'text-neon-yellow';
    if (entry.is_win) return 'text-neon-green';
    return 'text-neon-red';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background cyber-grid animate-grid-scroll">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/lobby')} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" /><span className="font-body">Lobby</span>
            </button>
            <div className="flex items-center gap-2">
              <Swords className="w-6 h-6 text-primary" />
              <span className="font-heading font-bold text-xl text-primary text-glow-cyan">MATCH HISTORY</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="font-heading text-xs tracking-wider">
            PROFILE
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { icon: <Target className="w-4 h-4 text-primary" />, label: 'MATCHES', value: stats.total },
            { icon: <Trophy className="w-4 h-4 text-neon-yellow" />, label: 'WINS', value: stats.wins },
            { icon: <TrendingDown className="w-4 h-4 text-neon-red" />, label: 'LOSSES', value: stats.losses },
            { icon: <Minus className="w-4 h-4 text-neon-yellow" />, label: 'DRAWS', value: stats.draws },
            { icon: <Flame className="w-4 h-4 text-neon-magenta" />, label: 'WIN RATE', value: `${winRate}%` },
            { icon: <TrendingUp className="w-4 h-4 text-neon-green" />, label: 'BEST', value: stats.bestScore },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card/50 border border-border rounded-lg p-3 text-center">
              <div className="flex justify-center mb-1">{stat.icon}</div>
              <div className="font-heading text-lg text-foreground">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground font-heading">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Win rate bar */}
        {stats.total > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="bg-card/50 border border-border rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="font-heading text-xs text-muted-foreground">PERFORMANCE</span>
              <span className="font-mono text-xs text-primary">{stats.wins}W - {stats.losses}L - {stats.draws}D</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
              {stats.wins > 0 && (
                <div className="h-full bg-neon-green transition-all" style={{ width: `${(stats.wins / stats.total) * 100}%` }} />
              )}
              {stats.draws > 0 && (
                <div className="h-full bg-neon-yellow transition-all" style={{ width: `${(stats.draws / stats.total) * 100}%` }} />
              )}
              {stats.losses > 0 && (
                <div className="h-full bg-neon-red transition-all" style={{ width: `${(stats.losses / stats.total) * 100}%` }} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-[10px] font-body text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-neon-green inline-block" /> Wins
              </span>
              <span className="flex items-center gap-1 text-[10px] font-body text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-neon-yellow inline-block" /> Draws
              </span>
              <span className="flex items-center gap-1 text-[10px] font-body text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-neon-red inline-block" /> Losses
              </span>
            </div>
          </motion.div>
        )}

        {/* Match list */}
        <div className="space-y-2">
          <h2 className="font-heading text-sm text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> RECENT MATCHES
          </h2>

          {fetching ? (
            <div className="text-center py-12">
              <div className="text-primary font-heading text-sm animate-pulse">LOADING HISTORY...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-card/30 border border-border rounded-lg">
              <div className="text-4xl mb-4">⚔️</div>
              <p className="text-muted-foreground font-body">No matches yet. Enter the arena!</p>
              <Button onClick={() => navigate('/lobby')} className="mt-4 font-heading text-sm">
                FIND MATCH
              </Button>
            </div>
          ) : (
            history.map((entry, i) => (
              <motion.div
                key={entry.participant.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => entry.match.status === 'finished' ? navigate(`/results/${entry.match.id}`) : entry.match.status === 'in_progress' ? navigate(`/arena/${entry.match.id}`) : null}
                className={`bg-card/50 border border-border rounded-lg p-4 flex items-center gap-4 transition-colors ${
                  entry.match.status === 'finished' || entry.match.status === 'in_progress' ? 'cursor-pointer hover:border-primary/30' : ''
                }`}
              >
                {/* Result indicator */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  entry.match.status !== 'finished' ? 'bg-muted/50' :
                  entry.is_win ? 'bg-neon-green/10 border border-neon-green/20' :
                  entry.is_draw ? 'bg-neon-yellow/10 border border-neon-yellow/20' :
                  'bg-neon-red/10 border border-neon-red/20'
                }`}>
                  {getResultIcon(entry)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-heading text-sm ${getResultColor(entry)}`}>
                      {getResultLabel(entry)}
                    </span>
                    {getStatusBadge(entry.match)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-body">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDate(entry.participant.joined_at)}
                    </span>
                    <span>{formatTime(entry.participant.joined_at)}</span>
                    <span>{entry.opponent_count + 1} players</span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex-shrink-0 text-right">
                  <div className="font-heading text-lg text-foreground">{entry.participant.score}</div>
                  <div className="text-[10px] text-muted-foreground font-heading">SCORE</div>
                </div>

                {/* Problems solved */}
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <div className="font-heading text-lg text-primary">{entry.participant.problems_solved}</div>
                  <div className="text-[10px] text-muted-foreground font-heading">SOLVED</div>
                </div>

                {/* Rank */}
                {entry.participant.rank && (
                  <div className="flex-shrink-0 text-right hidden md:block">
                    <div className={`font-heading text-lg ${entry.participant.rank === 1 ? 'text-neon-yellow' : 'text-foreground'}`}>
                      #{entry.participant.rank}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-heading">RANK</div>
                  </div>
                )}

                {/* Arrow */}
                {(entry.match.status === 'finished' || entry.match.status === 'in_progress') && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchHistory;
