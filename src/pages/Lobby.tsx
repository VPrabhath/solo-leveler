import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Swords, LogOut, User, Shield, Zap, Search, Loader2, History, Send, MessageSquare } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Match = Database['public']['Tables']['matches']['Row'];

interface WaitingPlayer {
  user_id: string;
  username: string;
  elo_rating: number;
  rank_tier: string;
  updated_at: string;
}

const Lobby = () => {
  const { user, profile, isAdmin, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [players, setPlayers] = useState<WaitingPlayer[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [searchDots, setSearchDots] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const chatChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  // Animate search dots
  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(() => setSearchDots(d => (d + 1) % 4), 500);
    return () => clearInterval(interval);
  }, [searching]);

  // Online status heartbeat & Presence
  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel('online-presence', {
      config: { presence: { key: user.id } }
    });

    const updateStatus = async () => {
      await supabase.from('profiles').update({ updated_at: new Date().toISOString() }).eq('user_id', user.id);
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = Object.values(state).flat();
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            username: profile.username,
            elo_rating: profile.elo_rating,
            online_at: new Date().toISOString(),
          });
        }
      });

    updateStatus();
    const interval = setInterval(updateStatus, 10000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  // Real-time Chat
  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      const { data } = await (supabase
        .from('lobby_messages' as any) as any)
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setMessages(data.reverse());
    };
    fetchMessages();

    const channel = supabase.channel('lobby-chat', {
      config: { presence: { key: user.id } }
    });
    chatChannelRef.current = channel;

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_messages' }, async (payload) => {
        const { data: profile } = await supabase.from('profiles').select('username').eq('user_id', payload.new.user_id).single();
        const newMessage = { ...payload.new, profiles: profile };
        setMessages(prev => [...prev, newMessage]);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing = Object.values(state).flat().filter((p: any) => p.isTyping && p.user_id !== user.id).map((p: any) => p.username);
        setTypingUsers([...new Set(typing)]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, username: profile?.username, isTyping: false });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      chatChannelRef.current = null;
    };
  }, [user, profile]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (chatChannelRef.current && user) {
      chatChannelRef.current.track({ user_id: user.id, username: profile?.username, isTyping: true });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (chatChannelRef.current) {
          chatChannelRef.current.track({ user_id: user.id, username: profile?.username, isTyping: false });
        }
      }, 2000);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage('');

    if (chatChannelRef.current) {
      chatChannelRef.current.track({ user_id: user.id, username: profile?.username, isTyping: false });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    try {
      await (supabase.from('lobby_messages' as any) as any).insert({
        user_id: user.id,
        content
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Subscribe to match changes when we have a matchId
  useEffect(() => {
    if (!matchId || !user) return;

    const fetchPlayers = async () => {
      const { data } = await supabase.from('match_participants').select('player_id').eq('match_id', matchId);
      if (!data) return;
      const ids = data.map(d => d.player_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, elo_rating, rank_tier, updated_at').in('user_id', ids);
      if (profiles) setPlayers(profiles as WaitingPlayer[]);
    };
    fetchPlayers();

    const channel = supabase.channel(`lobby-match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        const match = payload.new as Match;
        if (match?.status === 'countdown') {
          startCountdown(match.id);
        } else if (match?.status === 'in_progress') {
          navigate(`/arena/${match.id}`);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_participants', filter: `match_id=eq.${matchId}` }, () => {
        fetchPlayers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, user]);

  const startCountdown = (id: string) => {
    setSearching(false);
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          navigate(`/arena/${id}`);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const findMatch = async () => {
    if (!user || searching) return;
    setSearching(true);

    try {
      // 1. Check if user is already in an active match
      const { data: existingParticipation } = await supabase
        .from('match_participants')
        .select('match_id, matches!inner(status, start_time, time_limit_minutes)')
        .eq('player_id', user.id);

      let activeMatch = existingParticipation?.find(p => {
        const match = p.matches as any;
        return ['waiting', 'countdown', 'in_progress'].includes(match.status);
      });

      if (activeMatch) {
        const match = activeMatch.matches as any;
        let isViable = true;

        // If it's in progress, check if it's naturally expired
        if (match.status === 'in_progress' && match.start_time) {
          const startTime = new Date(match.start_time).getTime();
          const limitMs = (match.time_limit_minutes || 10) * 60 * 1000;
          if (Date.now() - startTime > limitMs) isViable = false;
        }

        // Check if opponents are actually online (otherwise it's a ghost match)
        if (isViable && match.status !== 'waiting') {
          const { data: opponents } = await supabase
            .from('match_participants')
            .select('player_id, profiles(updated_at)')
            .eq('match_id', activeMatch.match_id)
            .neq('player_id', user.id);

          if (!opponents || opponents.length === 0) {
            isViable = false;
          } else {
            const recentThreshold = new Date(Date.now() - 35 * 1000);
            const hasOnlineOpponent = opponents.some(o => {
              const updatedAt = new Date((o.profiles as any)?.updated_at || 0);
              return updatedAt > recentThreshold;
            });
            if (!hasOnlineOpponent) isViable = false;
          }
        }

        if (isViable) {
          setMatchId(activeMatch.match_id);
          if (match.status === 'countdown') startCountdown(activeMatch.match_id);
          else if (match.status === 'in_progress') navigate(`/arena/${activeMatch.match_id}`);
          else setSearching(false); // Let them sit in the lobby waiting room
          return;
        } else {
          // Not viable (ghost match), delete our participation so we can find a new one cleanly
          await supabase.from('match_participants')
            .delete()
            .eq('match_id', activeMatch.match_id)
            .eq('player_id', user.id);
          activeMatch = undefined;
        }
      }

      // 2. NEW: Get recent opponents to avoid consecutive matches
      const { data: recentMatches } = await supabase
        .from('match_participants')
        .select('match_id, matches!inner(status)')
        .eq('player_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(5);

      let recentOpponentIds: string[] = [];
      if (recentMatches && recentMatches.length > 0) {
        const validMatchIds = recentMatches
          .filter(m => ['in_progress', 'finished'].includes((m.matches as any)?.status))
          .map(m => m.match_id);

        if (validMatchIds.length > 0) {
          const { data: opponents } = await supabase
            .from('match_participants')
            .select('player_id')
            .in('match_id', validMatchIds)
            .neq('player_id', user.id);

          if (opponents) {
            recentOpponentIds = opponents.map(o => o.player_id);
          }
        }
      }

      // 3. Pre-flight check: Are there any OTHER actively online profiles?
      const now = new Date();
      const recentThreshold = new Date(now.getTime() - 25 * 1000).toISOString();

      const { data: activeProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .gt('updated_at', recentThreshold)
        .neq('user_id', user.id);

      const eligibleProfiles = (activeProfiles || []).filter(p => !recentOpponentIds.includes(p.user_id));

      if (!activeProfiles || activeProfiles.length === 0) {
        toast({ title: 'No Players Online', description: 'There are no active players available for a match right now.', variant: 'destructive' });
        setSearching(false);
        return;
      }

      if (eligibleProfiles.length === 0) {
        toast({ title: 'No New Opponents', description: 'Only recent opponents are online. Please wait for new players to join.', variant: 'default' });
        setSearching(false);
        return;
      }

      // 4. Find an existing waiting match with room and active players
      const { data: waitingMatches } = await supabase
        .from('matches')
        .select('id, max_players, problem_ids')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
        .limit(10);

      let targetMatchId: string | null = null;
      let targetMatchPlayers = 0;

      for (const match of (waitingMatches || [])) {
        // Get participants
        const { data: participants } = await supabase
          .from('match_participants')
          .select('player_id, profiles(updated_at)')
          .eq('match_id', match.id);

        const parts = participants || [];
        if (parts.length === 0) continue; // Skip completely empty matches

        let allEligible = true;
        for (const p of parts) {
          if (p.player_id === user.id) continue;
          const updatedAt = new Date((p.profiles as any)?.updated_at || 0);
          const isOnline = updatedAt > new Date(recentThreshold);
          const isEligible = !recentOpponentIds.includes(p.player_id);
          if (!isOnline || !isEligible) {
            allEligible = false;
            break;
          }
        }

        // Only join if room is actively healthy and the player inside isn't someone we just played
        if (allEligible && parts.length > 0 && parts.length < match.max_players) {
          targetMatchId = match.id;
          targetMatchPlayers = parts.length;
          break;
        }
      }

      // 5. Create new match if none found
      if (!targetMatchId) {
        // Get random problems: 2 easy, 2 medium, 1 hard
        const { data: easyProblems } = await supabase.from('problems').select('id').eq('difficulty', 'easy').eq('is_active', true);
        const { data: mediumProblems } = await supabase.from('problems').select('id').eq('difficulty', 'medium').eq('is_active', true);
        const { data: hardProblems } = await supabase.from('problems').select('id').eq('difficulty', 'hard').eq('is_active', true);

        const shuffle = <T,>(arr: T[]): T[] => arr.sort(() => Math.random() - 0.5);

        const selectedEasy = shuffle(easyProblems || []).slice(0, 2).map(p => p.id);
        const selectedMedium = shuffle(mediumProblems || []).slice(0, 2).map(p => p.id);
        const selectedHard = shuffle(hardProblems || []).slice(0, 1).map(p => p.id);
        const problemIds = [...selectedEasy, ...selectedMedium, ...selectedHard];

        if (problemIds.length < 1) throw new Error('Not enough problems in the database to create a match.');

        const { data: newMatch, error: matchError } = await supabase
          .from('matches')
          .insert({ problem_ids: problemIds, max_players: 8, time_limit_minutes: 10, status: 'waiting' })
          .select('id')
          .single();

        if (matchError || !newMatch) throw new Error('Failed to create match: ' + (matchError?.message || 'unknown'));
        targetMatchId = newMatch.id;
        targetMatchPlayers = 0;
      }

      // 6. Join the match
      const { error: joinError } = await supabase
        .from('match_participants')
        .insert({ match_id: targetMatchId, player_id: user.id });

      if (joinError && !joinError.message.includes('duplicate')) {
        throw new Error('Failed to join match: ' + joinError.message);
      }

      setMatchId(targetMatchId);

      // 7. If we reached min players (us + 1 remaining), start match
      if (targetMatchPlayers >= 1) {
        await supabase.from('matches').update({ status: 'countdown' }).eq('id', targetMatchId).eq('status', 'waiting');

        // Auto-transition to in_progress after 5s
        setTimeout(async () => {
          await supabase.from('matches').update({ status: 'in_progress', start_time: new Date().toISOString() }).eq('id', targetMatchId).eq('status', 'countdown');
        }, 5000);
      }

    } catch (err: any) {
      console.error('Matchmaking error:', err);
      toast({ title: 'Matchmaking Error', description: err.message || 'Failed to find a match', variant: 'destructive' });
      setSearching(false);
    }
  };

  const cancelSearch = async () => {
    if (matchId && user) {
      // Remove player from match participants
      await supabase.from('match_participants')
        .delete()
        .eq('match_id', matchId)
        .eq('player_id', user.id);
    }
    setSearching(false);
    setMatchId(null);
    setPlayers([]);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-primary font-heading text-xl animate-pulse">LOADING ARENA...</div></div>;
  }

  // Countdown overlay
  if (countdown !== null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div key={countdown} initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', bounce: 0.5 }} className="text-center">
          <div className="font-heading text-9xl text-primary text-glow-cyan">{countdown}</div>
          <p className="font-heading text-xl text-foreground mt-4">MATCH STARTING</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cyber-grid animate-grid-scroll">
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Swords className="w-6 h-6 text-primary" />
            <span className="font-heading font-bold text-xl text-primary text-glow-cyan">CODEARENA</span>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="font-heading text-xs tracking-wider text-neon-magenta">
                <Shield className="w-4 h-4 mr-1" /> ADMIN
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')} className="font-heading text-xs tracking-wider">
              <History className="w-4 h-4 mr-1" /> HISTORY
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="font-heading text-xs tracking-wider">
              <User className="w-4 h-4 mr-1" /> PROFILE
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-body text-foreground">{profile?.username || 'Warrior'}</span>
              <span className="font-mono text-xs text-primary">{profile?.elo_rating || 1200} ELO</span>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="w-4 h-4 text-muted-foreground" /></Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <h1 className="text-4xl font-heading font-bold text-foreground mb-2">
            BATTLE <span className="text-primary text-glow-cyan">LOBBY</span>
          </h1>
          <p className="text-muted-foreground font-body mb-12">Find a match. Destroy the competition. 10 minutes. Best code wins.</p>

          {/* Match card */}
          <div className="bg-card/50 border border-border rounded-xl p-8 max-w-lg mx-auto mb-8">
            {!searching && !matchId ? (
              <>
                <div className="text-6xl mb-6">⚔️</div>
                <h2 className="font-heading text-xl text-foreground mb-2">READY TO FIGHT?</h2>
                <p className="text-muted-foreground font-body text-sm mb-2">
                  Auto-match with opponents • 5 coding problems
                </p>
                <p className="text-muted-foreground font-body text-xs mb-6">
                  10 min time limit • Time & space complexity compared • Winner takes ELO
                </p>
                <Button onClick={findMatch} className="w-full h-14 font-heading text-lg tracking-wider glow-cyan">
                  <Search className="w-5 h-5 mr-2" /> FIND MATCH
                </Button>
              </>
            ) : (
              <>
                {/* Searching / Waiting state */}
                <div className="flex items-center justify-center gap-2 text-primary font-heading text-sm mb-6">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  SEARCHING FOR OPPONENTS{'.'.repeat(searchDots)}
                </div>

                {/* Searching animation */}
                <div className="relative w-32 h-32 mx-auto mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary"
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-3 rounded-full border-2 border-secondary/30 border-t-secondary"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Swords className="w-8 h-8 text-primary" />
                  </div>
                </div>

                {/* Connected players */}
                {players.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <p className="font-heading text-xs text-muted-foreground mb-2">
                      PLAYERS FOUND: {players.length}
                    </p>
                    {players.map(p => {
                      const isOnline = new Date(p.updated_at || 0) > new Date(Date.now() - 35 * 1000);
                      return (
                        <motion.div key={p.user_id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between px-4 py-2 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <span className="font-heading text-xs text-foreground">{p.username?.charAt(0).toUpperCase()}</span>
                              </div>
                              {isOnline && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-neon-green rounded-full border-2 border-background" />
                              )}
                            </div>
                            <span className="font-body text-foreground text-sm">{p.username}</span>
                            {p.user_id === user?.id && <span className="text-xs text-primary font-heading">(YOU)</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-primary">{p.elo_rating}</span>
                            <span className="font-heading text-xs text-muted-foreground">{p.rank_tier}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {players.length >= 2 && (
                  <div className="text-neon-green font-heading text-sm flex items-center justify-center gap-2 mb-4">
                    <Zap className="w-4 h-4" /> MATCH FOUND — STARTING SOON...
                  </div>
                )}

                <Button variant="outline" onClick={cancelSearch} className="w-full font-heading text-sm tracking-wider">
                  CANCEL SEARCH
                </Button>
              </>
            )}
          </div>

          {/* Online Players Sidebar/Section */}
          <div className="mt-12 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
              <h3 className="font-heading text-xs text-muted-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                ACTIVE HACKERS ONLINE ({onlineUsers.length})
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {onlineUsers.length > 0 ? (
                onlineUsers.map((u: any) => (
                  <motion.div key={u.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-2 bg-muted/20 rounded-full px-3 py-1.5 border border-white/5">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{u.username?.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-xs font-body truncate max-w-[80px]">{u.username}</span>
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto">{u.elo_rating}</span>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full text-center py-4 text-muted-foreground text-xs italic">
                  Scanning for signatures...
                </div>
              )}
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mt-12">
            <div className="bg-card/30 border border-border rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">⏱️</div>
              <h3 className="font-heading text-sm text-foreground mb-1">10 MINUTES</h3>
              <p className="text-muted-foreground font-body text-xs">Race against the clock</p>
            </div>
            <div className="bg-card/30 border border-border rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-heading text-sm text-foreground mb-1">COMPLEXITY</h3>
              <p className="text-muted-foreground font-body text-xs">Time & space compared</p>
            </div>
            <div className="bg-card/30 border border-border rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">🏆</div>
              <h3 className="font-heading text-sm text-foreground mb-1">ELO RANKED</h3>
              <p className="text-muted-foreground font-body text-xs">Climb the leaderboard</p>
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="w-full md:w-80 flex flex-col h-[600px] bg-card/50 border border-border rounded-xl overflow-hidden backdrop-blur-xl">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-heading text-xs text-primary flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> GLOBAL TERMINAL
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((msg, i) => (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold ${msg.user_id === user?.id ? 'text-primary' : 'text-neon-cyan'}`}>
                    {msg.profiles?.username || 'GHOST'}
                  </span>
                  <span className="text-[8px] text-muted-foreground font-mono">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs font-body text-foreground/90 break-words leading-relaxed bg-muted/20 p-2 rounded border border-white/5">
                  {msg.content}
                </p>
              </div>
            ))}
            {typingUsers.length > 0 && (
              <div className="flex gap-1 items-center animate-pulse mt-2 pl-2 border-l-2 border-primary/30">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} className="p-3 border-t border-border bg-muted/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="flex-1 bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs font-body focus:outline-none focus:border-primary/50"
              />
              <Button type="submit" size="icon" className="h-8 w-8 glow-cyan">
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
