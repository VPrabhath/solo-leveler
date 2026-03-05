import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Swords, ArrowLeft, Trophy, Target, Flame, TrendingUp, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Database } from '@/integrations/supabase/types';

type Submission = Database['public']['Tables']['submissions']['Row'];

const rankTiers = [
  { name: 'Bronze', min: 0, max: 999, color: 'text-orange-400', border: 'border-orange-400/30' },
  { name: 'Silver', min: 1000, max: 1399, color: 'text-gray-300', border: 'border-gray-300/30' },
  { name: 'Gold', min: 1400, max: 1799, color: 'text-neon-yellow', border: 'border-neon-yellow/30' },
  { name: 'Diamond', min: 1800, max: 2199, color: 'text-neon-cyan', border: 'border-neon-cyan/30' },
  { name: 'Legendary', min: 2200, max: 9999, color: 'text-neon-magenta', border: 'border-neon-magenta/30' },
];

const Profile = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: subs } = await supabase.from('submissions').select('*').eq('player_id', user.id).order('submitted_at', { ascending: false }).limit(50);
      if (subs) setSubmissions(subs);

      const { data: matches } = await supabase.from('match_participants').select('*').eq('player_id', user.id).order('joined_at', { ascending: false }).limit(20);
      if (matches) setMatchHistory(matches);
    };
    fetchData();
  }, [user]);

  if (loading || !profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-primary font-heading text-xl animate-pulse">LOADING...</div></div>;
  }

  const currentTier = rankTiers.find(t => (profile.elo_rating || 1200) >= t.min && (profile.elo_rating || 1200) <= t.max) || rankTiers[0];
  const nextTier = rankTiers[rankTiers.indexOf(currentTier) + 1];
  const progressToNext = nextTier ? ((profile.elo_rating - currentTier.min) / (nextTier.min - currentTier.min)) * 100 : 100;

  const winRate = profile.total_matches > 0 ? Math.round((profile.wins / profile.total_matches) * 100) : 0;

  const acceptedSubs = submissions.filter(s => s.result === 'accepted').length;
  const totalSubs = submissions.length;
  const accuracy = totalSubs > 0 ? Math.round((acceptedSubs / totalSubs) * 100) : 0;

  // Build ELO history from match data
  const eloHistory = (() => {
    if (matchHistory.length === 0) return [{ match: 'Start', elo: profile.elo_rating }];
    // Reverse to chronological order, estimate ELO changes
    const reversed = [...matchHistory].reverse();
    let currentElo = 1200; // starting ELO
    return [
      { match: 'Start', elo: 1200 },
      ...reversed.map((m, i) => {
        const change = m.rank === 1 ? 25 : m.score > 0 ? 10 : -10;
        currentElo += change;
        return { match: `M${i + 1}`, elo: currentElo };
      }),
    ];
  })();

  return (
    <div className="min-h-screen bg-background cyber-grid animate-grid-scroll">
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/lobby')} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" /><span className="font-body">Lobby</span>
            </button>
            <div className="flex items-center gap-2">
              <Swords className="w-6 h-6 text-primary" />
              <span className="font-heading font-bold text-xl text-primary text-glow-cyan">PROFILE</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Player card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`bg-card/50 border ${currentTier.border} rounded-xl p-8 mb-8`}>
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 ${currentTier.border}`}>
              <span className="font-heading text-2xl text-foreground">{profile.username?.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="font-heading text-3xl text-foreground">{profile.username}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`font-heading text-sm ${currentTier.color}`}>{currentTier.name}</span>
                <span className="text-primary font-mono text-sm">{profile.elo_rating} ELO</span>
                <span className="text-muted-foreground font-body text-sm">🏳️ {profile.country || 'UN'}</span>
              </div>
              {nextTier && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-body mb-1">
                    <span>{nextTier.min - profile.elo_rating} ELO to {nextTier.name}</span>
                  </div>
                  <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(progressToNext, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: <Trophy className="w-5 h-5 text-neon-yellow" />, label: 'WINS', value: profile.wins },
            { icon: <Target className="w-5 h-5 text-neon-cyan" />, label: 'MATCHES', value: profile.total_matches },
            { icon: <Flame className="w-5 h-5 text-neon-magenta" />, label: 'WIN RATE', value: `${winRate}%` },
            { icon: <BarChart3 className="w-5 h-5 text-neon-green" />, label: 'ACCURACY', value: `${accuracy}%` },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-card/50 border border-border rounded-lg p-4 text-center">
              <div className="flex justify-center mb-2">{stat.icon}</div>
              <div className="font-heading text-2xl text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground font-heading">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* ELO Chart */}
        <div className="bg-card/50 border border-border rounded-lg p-6 mb-8">
          <h2 className="font-heading text-sm text-muted-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> RATING HISTORY
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={eloHistory}>
              <XAxis dataKey="match" stroke="hsl(220, 10%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 55%)" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(230, 20%, 10%)', border: '1px solid hsl(230, 15%, 18%)', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(200, 20%, 90%)', fontFamily: 'Orbitron' }}
              />
              <Line type="monotone" dataKey="elo" stroke="hsl(190, 100%, 50%)" strokeWidth={2} dot={{ fill: 'hsl(190, 100%, 50%)', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent submissions */}
        <div className="bg-card/50 border border-border rounded-lg p-6">
          <h2 className="font-heading text-sm text-muted-foreground mb-4">RECENT SUBMISSIONS</h2>
          {submissions.length === 0 ? (
            <p className="text-muted-foreground font-body text-sm">No submissions yet. Enter the arena!</p>
          ) : (
            <div className="space-y-2">
              {submissions.slice(0, 10).map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`font-heading text-xs ${
                      s.result === 'accepted' ? 'text-neon-green' :
                      s.result === 'partial' ? 'text-neon-yellow' : 'text-neon-red'
                    }`}>{s.result.toUpperCase()}</span>
                    <span className="text-muted-foreground font-mono text-xs">{s.language}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-xs">{s.test_cases_passed}/{s.test_cases_total}</span>
                    <span className="text-primary font-mono text-xs">+{s.score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
