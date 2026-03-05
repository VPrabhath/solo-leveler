import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Swords, Play, Trophy, Clock, ChevronRight, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import type { Database } from '@/integrations/supabase/types';

type Problem = Database['public']['Tables']['problems']['Row'];

interface TestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

interface ComplexityInfo {
  time_complexity: string;
  space_complexity: string;
  explanation: string;
}

interface LeaderboardEntry {
  player_id: string;
  username: string;
  score: number;
  problems_solved: number;
  streak: number;
}

const Arena = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const defaultTemplates: Record<string, string> = {
    javascript: '// Write your solution here\nfunction solution(input) {\n  // your code\n  return input;\n}',
    python: '# Write your solution here\ndef solution(input):\n    # your code\n    return input\n',
  };
  const [code, setCode] = useState(defaultTemplates.javascript);
  const [language, setLanguage] = useState('javascript');
  const [submitting, setSubmitting] = useState(false);
  const [solvedProblems, setSolvedProblems] = useState<Set<number>>(new Set());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(10 * 60); // Default 10 minutes
  const [matchEnded, setMatchEnded] = useState(false);
  const [lastResult, setLastResult] = useState<{ passed: number; total: number; accepted: boolean; complexity?: ComplexityInfo; results?: any[] } | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch match problems
  useEffect(() => {
    if (!matchId) return;
    const fetchMatch = async () => {
      const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
      if (!match || !match.problem_ids?.length) return;

      const { data: probs } = await supabase.from('problems').select('*').in('id', match.problem_ids);
      if (probs) {
        const sorted = [
          ...probs.filter(p => p.difficulty === 'easy'),
          ...probs.filter(p => p.difficulty === 'medium'),
          ...probs.filter(p => p.difficulty === 'hard'),
        ];
        setProblems(sorted);
      }
      if (match.time_limit_minutes) setTimeLeft(match.time_limit_minutes * 60);
    };
    fetchMatch();
  }, [matchId]);

  // Timer
  useEffect(() => {
    if (matchEnded) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setMatchEnded(true);
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [matchEnded]);

  // Realtime leaderboard
  useEffect(() => {
    if (!matchId) return;
    const fetchLeaderboard = async () => {
      const { data } = await supabase.from('match_participants').select('*').eq('match_id', matchId).order('score', { ascending: false });
      if (data) {
        const playerIds = data.map(d => d.player_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, username').in('user_id', playerIds);
        const nameMap = new Map(profiles?.map(p => [p.user_id, p.username]) || []);
        setLeaderboard(data.map(d => ({
          player_id: d.player_id,
          username: nameMap.get(d.player_id) || 'Unknown',
          score: d.score,
          problems_solved: d.problems_solved,
          streak: d.streak,
        })));
      }
    };
    fetchLeaderboard();

    const channel = supabase.channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_participants', filter: `match_id=eq.${matchId}` }, () => fetchLeaderboard())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        const match = payload.new as any;
        if (match?.status === 'finished') {
          setMatchEnded(true);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  const currentProblem = problems[currentProblemIndex];
  const isLocked = (index: number) => index >= 4 && solvedProblems.size < 3;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const timerColor = () => {
    if (timeLeft > 5 * 60) return 'text-neon-green';
    if (timeLeft > 2 * 60) return 'text-neon-yellow';
    if (timeLeft > 60) return 'text-orange-400';
    return 'text-neon-red animate-pulse';
  };

  const submitCode = async () => {
    if (!currentProblem || !matchId || !user) return;
    setSubmitting(true);
    setLastResult(null);

    try {
      const response = await supabase.functions.invoke('execute-code', {
        body: {
          code,
          language,
          test_cases: currentProblem.test_cases,
          time_limit_seconds: currentProblem.time_limit_seconds,
        },
      });

      const result = response.data;
      const passed = result?.passed || 0;
      const total = result?.total || ((currentProblem.test_cases as unknown as TestCase[])?.length || 0);
      const accepted = passed === total && total > 0;
      const complexity: ComplexityInfo | undefined = result?.complexity;
      const detailedResults = result?.results || [];

      setLastResult({ passed, total, accepted, complexity, results: detailedResults });

      // Score based on difficulty + complexity bonus
      const diffPoints = currentProblem.difficulty === 'easy' ? 100 : currentProblem.difficulty === 'medium' ? 200 : 400;
      const partialScore = Math.floor((passed / Math.max(total, 1)) * diffPoints);
      const newStreak = accepted ? streak + 1 : 0;
      const multiplier = Math.min(newStreak, 3);

      // Complexity bonus: better complexity = more points
      let complexityBonus = 0;
      if (accepted && complexity) {
        const tc = complexity.time_complexity;
        if (tc === 'O(1)') complexityBonus = 50;
        else if (tc === 'O(log n)') complexityBonus = 40;
        else if (tc === 'O(n)') complexityBonus = 30;
        else if (tc === 'O(n log n)') complexityBonus = 20;
        else if (tc === 'O(n²)') complexityBonus = 5;
      }

      const earnedScore = (accepted ? diffPoints * Math.max(multiplier, 1) : partialScore) + complexityBonus;

      setStreak(newStreak);
      const newSolvedProblems = accepted ? new Set([...solvedProblems, currentProblemIndex]) : solvedProblems;
      if (accepted) setSolvedProblems(newSolvedProblems);

      // Use functional update to get latest score and avoid stale closure
      let latestScore = 0;
      setScore(prev => {
        latestScore = prev + earnedScore;
        return latestScore;
      });
      // Wait a tick for state to flush
      await new Promise(r => setTimeout(r, 0));

      // Save submission
      await supabase.from('submissions').insert({
        player_id: user.id,
        match_id: matchId,
        problem_id: currentProblem.id,
        code,
        language,
        result: accepted ? 'accepted' : passed > 0 ? 'partial' : 'wrong_answer',
        score: earnedScore,
        test_cases_passed: passed,
        test_cases_total: total,
        execution_time_ms: result?.execution_time_ms || null,
      });

      // Update participant using latest values
      await supabase.from('match_participants')
        .update({
          score: score + earnedScore,
          problems_solved: newSolvedProblems.size,
          streak: newStreak,
        })
        .eq('match_id', matchId)
        .eq('player_id', user.id);

      if (accepted) {
        toast({ title: '✅ ACCEPTED!', description: `+${earnedScore} pts${complexityBonus > 0 ? ` (incl. ${complexityBonus} complexity bonus)` : ''}${multiplier > 1 ? ` • ${multiplier}x streak!` : ''}` });
      } else {
        toast({ title: '❌ Not quite', description: `${passed}/${total} test cases passed`, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Execution Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // When match ends, call finish-match edge function
  useEffect(() => {
    if (!matchEnded || !matchId) return;
    const triggerFinishMatch = async () => {
      try {
        await supabase.functions.invoke('finish-match', {
          body: { match_id: matchId },
        });
        toast({ title: '📈 RANK UPDATED', description: 'Your ELO and stats have been synchronized.' });
      } catch (err) {
        console.error('Failed to finish match:', err);
      }
    };
    triggerFinishMatch();
  }, [matchEnded, matchId]);

  if (matchEnded) {
    return (
      <div className="min-h-screen bg-background cyber-grid animate-grid-scroll flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-md">
          <div className="text-6xl mb-6">⏱️</div>
          <h1 className="font-heading text-4xl text-foreground mb-2">TIME'S UP!</h1>
          <p className="text-muted-foreground font-body mb-4">Final Score: <span className="text-primary font-heading text-2xl">{score}</span></p>
          <p className="text-muted-foreground font-body mb-8">Problems Solved: {solvedProblems.size}/{problems.length}</p>
          <Button onClick={() => navigate(`/results/${matchId}`)} className="font-heading tracking-wider glow-cyan">
            VIEW RESULTS <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </motion.div>
      </div>
    );
  }

  if (problems.length === 0) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-primary font-heading text-xl animate-pulse">LOADING ARENA...</div></div>;
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <Swords className="w-5 h-5 text-primary" />
          <span className="font-heading text-sm text-primary text-glow-cyan">CODEARENA</span>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1">
            {problems.map((p, i) => (
              <button key={p.id} onClick={() => !isLocked(i) && setCurrentProblemIndex(i)}
                disabled={isLocked(i)}
                className={`px-3 py-1 rounded text-xs font-heading transition-all ${i === currentProblemIndex ? 'bg-primary text-primary-foreground' :
                  solvedProblems.has(i) ? 'bg-neon-green/20 text-neon-green' :
                    isLocked(i) ? 'bg-muted/30 text-muted-foreground cursor-not-allowed' :
                      'bg-muted text-foreground hover:bg-muted/80'
                  }`}>
                {isLocked(i) ? <Lock className="w-3 h-3" /> : solvedProblems.has(i) ? <CheckCircle2 className="w-3 h-3" /> : `P${i + 1}`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-neon-yellow" />
            <span className="font-mono text-sm text-foreground">{score}</span>
            {streak > 1 && <Badge className="bg-neon-magenta/20 text-neon-magenta border-0 text-xs font-heading">{streak}x</Badge>}
          </div>
          <div className={`flex items-center gap-1 font-mono text-lg font-bold ${timerColor()}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      {/* Main content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="h-full overflow-y-auto p-6">
            {currentProblem && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={`border-0 font-heading text-xs ${currentProblem.difficulty === 'easy' ? 'bg-neon-green/20 text-neon-green' :
                    currentProblem.difficulty === 'medium' ? 'bg-neon-yellow/20 text-neon-yellow' :
                      'bg-neon-red/20 text-neon-red'
                    }`}>{currentProblem.difficulty.toUpperCase()}</Badge>
                  <h2 className="font-heading text-xl text-foreground">{currentProblem.title}</h2>
                </div>
                <div className="font-body text-foreground/80 text-base leading-relaxed whitespace-pre-wrap mb-6">
                  {currentProblem.description}
                </div>
                {currentProblem.constraints && (
                  <div className="mb-6">
                    <h3 className="font-heading text-xs text-muted-foreground mb-2">CONSTRAINTS</h3>
                    <pre className="font-mono text-sm text-foreground/60 bg-muted/50 rounded-lg p-3">{currentProblem.constraints}</pre>
                  </div>
                )}
                <div>
                  <h3 className="font-heading text-xs text-muted-foreground mb-2">EXAMPLES</h3>
                  {((currentProblem.test_cases as unknown as TestCase[]) || []).filter(tc => !tc.is_hidden).map((tc, i) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-3 mb-2 font-mono text-sm">
                      <div><span className="text-muted-foreground">Input: </span><span className="text-foreground">{tc.input}</span></div>
                      <div><span className="text-muted-foreground">Output: </span><span className="text-primary">{tc.expected_output}</span></div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={60} minSize={35}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={70} minSize={40}>
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
                  <Select value={language} onValueChange={(val) => {
                    setLanguage(val);
                    setCode(defaultTemplates[val] || defaultTemplates.javascript);
                    setLastResult(null);
                  }}>
                    <SelectTrigger className="w-44 bg-muted border-border font-mono text-sm h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="python">Python 3</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={submitCode} disabled={submitting} className="font-heading tracking-wider text-sm h-8 glow-cyan">
                    <Play className="w-3 h-3 mr-1" />{submitting ? 'RUNNING...' : 'SUBMIT'}
                  </Button>
                </div>
                <div className="flex-1">
                  <Editor
                    height="100%"
                    language={language === 'python' ? 'python' : 'javascript'}
                    value={code}
                    onChange={v => setCode(v || '')}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', monospace",
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 12 },
                      tabSize: language === 'python' ? 4 : 2,
                    }}
                  />
                </div>
                {/* Result feedback with complexity */}
                <AnimatePresence>
                  {lastResult && (
                    <motion.div initial={{ height: 0, opacity: 0, y: 10 }} animate={{ height: 'auto', opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: 10 }}
                      className={`border-t backdrop-blur-md px-4 py-4 ${lastResult.accepted ? 'border-neon-green/30 bg-neon-green/5' : 'border-neon-red/30 bg-neon-red/5'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {lastResult.accepted ? (
                            <div className="p-1.5 rounded-full bg-neon-green/10 text-neon-green shadow-glow-green">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-full bg-neon-red/10 text-neon-red shadow-glow-red">
                              <XCircle className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className={`font-heading text-sm font-bold tracking-tight ${lastResult.accepted ? 'text-neon-green' : 'text-neon-red'}`}>
                              {lastResult.accepted ? 'MISSION SUCCESS' : 'EXECUTION FAILED'}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                              {lastResult.passed}/{lastResult.total} TEST VECTORS VERIFIED
                            </span>
                          </div>
                        </div>
                        {lastResult.complexity && (
                          <div className="flex items-center gap-4 font-mono text-[10px]">
                            <div className="flex flex-col items-end">
                              <span className="text-muted-foreground/60">TIME</span>
                              <span className="text-primary font-bold">{lastResult.complexity.time_complexity}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-muted-foreground/60">SPACE</span>
                              <span className="text-secondary font-bold">{lastResult.complexity.space_complexity}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Detailed test results */}
                      {!lastResult.accepted && lastResult.results && (
                        <div className="mt-2 space-y-3 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                          {lastResult.results.map((res, i) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                              className={`p-3 rounded-lg border backdrop-blur-sm transition-all duration-300 ${res.passed
                                ? 'bg-neon-green/10 border-neon-green/20 hover:border-neon-green/40'
                                : 'bg-neon-red/10 border-neon-red/20 hover:border-neon-red/40'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${res.passed ? 'bg-neon-green' : 'bg-neon-red shadow-glow-red'}`} />
                                  <span className={`text-[10px] font-bold tracking-wider ${res.passed ? 'text-neon-green' : 'text-neon-red'}`}>
                                    VECTOR_{String(i + 1).padStart(3, '0')}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-mono ${res.passed ? 'text-neon-green/60' : 'text-neon-red/60'}`}>
                                  {res.passed ? 'STABLE' : 'BREACHED'}
                                </span>
                              </div>
                              {!res.passed && (
                                <div className="grid grid-cols-1 gap-2 mt-2 pt-2 border-t border-white/5 font-mono text-[11px]">
                                  <div className="flex items-start bg-black/20 p-2 rounded">
                                    <span className="text-muted-foreground mr-2 shrink-0">DATA:</span>
                                    <code className="text-foreground/90 break-all">{res.input}</code>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-neon-green/5 p-2 rounded border border-neon-green/10">
                                      <div className="text-[9px] text-neon-green/60 mb-1">EXPECTED_SIG</div>
                                      <code className="text-neon-green/90 break-all">{res.expected}</code>
                                    </div>
                                    <div className="bg-neon-red/5 p-2 rounded border border-neon-red/10">
                                      <div className="text-[9px] text-neon-red/60 mb-1">RECEIVED_SIG</div>
                                      <code className="text-neon-red/90 break-all">{res.actual}</code>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {lastResult.complexity && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <p className="text-muted-foreground font-body text-[11px] leading-relaxed italic">
                            <span className="text-primary">ANALYST NOTE:</span> {lastResult.complexity.explanation}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Leaderboard */}
            <ResizablePanel defaultSize={30} minSize={15}>
              <div className="h-full overflow-y-auto p-4">
                <h3 className="font-heading text-xs text-muted-foreground mb-3 flex items-center gap-2">
                  <Trophy className="w-3 h-3" /> LIVE LEADERBOARD
                </h3>
                <div className="space-y-1">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.player_id}
                      className={`flex items-center justify-between px-3 py-2 rounded text-sm ${entry.player_id === user?.id ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'
                        }`}>
                      <div className="flex items-center gap-2">
                        <span className={`font-heading text-xs w-5 ${i === 0 ? 'text-neon-yellow' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                          #{i + 1}
                        </span>
                        <span className="font-body text-foreground">{entry.username}</span>
                        {entry.streak > 1 && <span className="text-neon-magenta text-xs font-mono">🔥{entry.streak}x</span>}
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-muted-foreground">{entry.problems_solved} solved</span>
                        <span className="text-primary font-bold">{entry.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Red border glow in final minute */}
      {timeLeft <= 60 && timeLeft > 0 && (
        <div className="fixed inset-0 pointer-events-none border-4 border-neon-red/50 animate-pulse z-50 rounded-none" />
      )}
    </div>
  );
};

export default Arena;
