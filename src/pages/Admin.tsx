import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Swords, Plus, Pencil, Trash2, ArrowLeft, Eye, X, Save, Gamepad2, Clock, Users } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Problem = Database['public']['Tables']['problems']['Row'];
type Difficulty = Database['public']['Enums']['difficulty_level'];

interface TestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [previewProblem, setPreviewProblem] = useState<Problem | null>(null);
  const [activeTab, setActiveTab] = useState<'problems' | 'matches'>('problems');

  // Match creation state
  const [showMatchCreator, setShowMatchCreator] = useState(false);
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
  const [matchMaxPlayers, setMatchMaxPlayers] = useState(8);
  const [matchTimeLimit, setMatchTimeLimit] = useState(45);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [matches, setMatches] = useState<Database['public']['Tables']['matches']['Row'][]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [constraints, setConstraints] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [tags, setTags] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([{ input: '', expected_output: '', is_hidden: false }]);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate('/lobby');
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    fetchProblems();
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    const { data } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
    if (data) setMatches(data);
  };

  const fetchProblems = async () => {
    const { data } = await supabase.from('problems').select('*').order('created_at', { ascending: false });
    if (data) setProblems(data);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDifficulty('easy'); setConstraints('');
    setTimeLimitSeconds(30); setMemoryLimitMb(256); setTags('');
    setTestCases([{ input: '', expected_output: '', is_hidden: false }]);
    setEditingProblem(null);
  };

  const openEditor = (problem?: Problem) => {
    if (problem) {
      setEditingProblem(problem);
      setTitle(problem.title);
      setDescription(problem.description);
      setDifficulty(problem.difficulty);
      setConstraints(problem.constraints || '');
      setTimeLimitSeconds(problem.time_limit_seconds);
      setMemoryLimitMb(problem.memory_limit_mb);
      setTags((problem.tags || []).join(', '));
      setTestCases((problem.test_cases as unknown as TestCase[]) || [{ input: '', expected_output: '', is_hidden: false }]);
    } else {
      resetForm();
    }
    setShowEditor(true);
  };

  const saveProblem = async () => {
    const problemData = {
      title, description, difficulty, constraints: constraints || null,
      time_limit_seconds: timeLimitSeconds, memory_limit_mb: memoryLimitMb,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      test_cases: testCases as unknown as Database['public']['Tables']['problems']['Insert']['test_cases'],
      created_by: user?.id || null,
    };

    let error;
    if (editingProblem) {
      ({ error } = await supabase.from('problems').update(problemData).eq('id', editingProblem.id));
    } else {
      ({ error } = await supabase.from('problems').insert(problemData));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingProblem ? 'Problem updated!' : 'Problem created!' });
      setShowEditor(false); resetForm(); fetchProblems();
    }
  };

  const deleteProblem = async (id: string) => {
    const { error } = await supabase.from('problems').delete().eq('id', id);
    if (!error) { fetchProblems(); toast({ title: 'Problem deleted' }); }
  };

  const addTestCase = () => setTestCases([...testCases, { input: '', expected_output: '', is_hidden: false }]);
  const removeTestCase = (i: number) => setTestCases(testCases.filter((_, idx) => idx !== i));
  const updateTestCase = (i: number, field: keyof TestCase, value: string | boolean) => {
    const updated = [...testCases];
    (updated[i] as any)[field] = value;
    setTestCases(updated);
  };

  const diffColor = (d: Difficulty) => d === 'easy' ? 'bg-neon-green/20 text-neon-green' : d === 'medium' ? 'bg-neon-yellow/20 text-neon-yellow' : 'bg-neon-red/20 text-neon-red';

  const toggleProblemSelection = (id: string) => {
    setSelectedProblemIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const createMatch = async () => {
    if (selectedProblemIds.length < 5) {
      toast({ title: 'Need at least 5 problems', description: 'Select 2 easy, 2 medium, and 1 hard problem.', variant: 'destructive' });
      return;
    }
    setCreatingMatch(true);
    const { error } = await supabase.from('matches').insert({
      problem_ids: selectedProblemIds,
      max_players: matchMaxPlayers,
      time_limit_minutes: matchTimeLimit,
      status: 'waiting',
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Match created!' });
      setShowMatchCreator(false);
      setSelectedProblemIds([]);
      fetchMatches();
    }
    setCreatingMatch(false);
  };

  const updateMatchStatus = async (matchId: string, status: Database['public']['Enums']['match_status']) => {
    const updateData: any = { status };
    if (status === 'in_progress') updateData.start_time = new Date().toISOString();
    if (status === 'finished') updateData.end_time = new Date().toISOString();
    
    const { error } = await supabase.from('matches').update(updateData).eq('id', matchId);
    if (!error) { fetchMatches(); toast({ title: `Match ${status}` }); }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-primary font-heading text-xl animate-pulse">LOADING...</div></div>;

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
              <span className="font-heading font-bold text-xl text-primary text-glow-cyan">ADMIN PANEL</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'problems' ? (
              <Button onClick={() => openEditor()} className="font-heading tracking-wider glow-cyan">
                <Plus className="w-4 h-4 mr-1" /> NEW PROBLEM
              </Button>
            ) : (
              <Button onClick={() => setShowMatchCreator(true)} className="font-heading tracking-wider glow-magenta">
                <Gamepad2 className="w-4 h-4 mr-1" /> CREATE MATCH
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="container mx-auto px-4 pt-6">
        <div className="flex gap-1 border-b border-border mb-6">
          <button onClick={() => setActiveTab('problems')}
            className={`px-6 py-3 font-heading text-sm tracking-wider transition-colors border-b-2 ${activeTab === 'problems' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            PROBLEMS ({problems.length})
          </button>
          <button onClick={() => setActiveTab('matches')}
            className={`px-6 py-3 font-heading text-sm tracking-wider transition-colors border-b-2 ${activeTab === 'matches' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            MATCHES ({matches.length})
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8">
        {activeTab === 'problems' ? (
        <div className="space-y-3">
          {problems.length === 0 && (
            <div className="text-center py-20 text-muted-foreground font-body">No problems yet. Create your first one!</div>
          )}
          {problems.map(p => (
            <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card/50 border border-border rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-4">
                <Badge className={`${diffColor(p.difficulty)} border-0 font-heading text-xs`}>
                  {p.difficulty.toUpperCase()}
                </Badge>
                <div>
                  <h3 className="font-heading text-foreground">{p.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {(p.tags || []).map(t => <span key={t} className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{t}</span>)}
                    <span className="text-xs text-muted-foreground font-mono">{((p.test_cases as unknown as TestCase[]) || []).length} tests</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setPreviewProblem(p)}><Eye className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => openEditor(p)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => deleteProblem(p.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </motion.div>
          ))}
        </div>
        ) : (
        /* Matches Tab */
        <div className="space-y-3">
          {matches.length === 0 && (
            <div className="text-center py-20 text-muted-foreground font-body">No matches yet. Create one!</div>
          )}
          {matches.map(m => {
            const statusColor = m.status === 'waiting' ? 'bg-neon-yellow/20 text-neon-yellow' : m.status === 'in_progress' ? 'bg-neon-green/20 text-neon-green' : m.status === 'countdown' ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-muted text-muted-foreground';
            return (
              <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-card/50 border border-border rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-4">
                  <Badge className={`${statusColor} border-0 font-heading text-xs`}>{m.status.toUpperCase()}</Badge>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-foreground text-sm">{(m.problem_ids || []).length} Problems</span>
                      <span className="text-muted-foreground font-mono text-xs">•</span>
                      <span className="text-muted-foreground font-mono text-xs flex items-center gap-1"><Users className="w-3 h-3" />{m.max_players} max</span>
                      <span className="text-muted-foreground font-mono text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{m.time_limit_minutes}min</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{m.id.slice(0, 8)}...</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.status === 'waiting' && (
                    <Button size="sm" variant="outline" onClick={() => updateMatchStatus(m.id, 'countdown')} className="font-heading text-xs text-neon-cyan">START</Button>
                  )}
                  {m.status === 'countdown' && (
                    <Button size="sm" variant="outline" onClick={() => updateMatchStatus(m.id, 'in_progress')} className="font-heading text-xs text-neon-green">GO LIVE</Button>
                  )}
                  {m.status === 'in_progress' && (
                    <Button size="sm" variant="outline" onClick={() => updateMatchStatus(m.id, 'finished')} className="font-heading text-xs text-neon-red">END</Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        )}
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl overflow-y-auto">
            <div className="container mx-auto px-4 py-8 max-w-3xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-heading text-2xl text-primary text-glow-cyan">
                  {editingProblem ? 'EDIT PROBLEM' : 'CREATE PROBLEM'}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => { setShowEditor(false); resetForm(); }}><X className="w-5 h-5" /></Button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-muted-foreground">TITLE</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 bg-muted border-border font-mono" placeholder="Two Sum" />
                  </div>
                  <div>
                    <Label className="font-body text-muted-foreground">DIFFICULTY</Label>
                    <Select value={difficulty} onValueChange={v => setDifficulty(v as Difficulty)}>
                      <SelectTrigger className="mt-1 bg-muted border-border font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="font-body text-muted-foreground">DESCRIPTION</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1 bg-muted border-border font-mono min-h-[150px]"
                    placeholder="Given an array of integers nums and an integer target, return indices of the two numbers..." />
                </div>

                <div>
                  <Label className="font-body text-muted-foreground">CONSTRAINTS</Label>
                  <Textarea value={constraints} onChange={e => setConstraints(e.target.value)} className="mt-1 bg-muted border-border font-mono"
                    placeholder="2 <= nums.length <= 10^4&#10;-10^9 <= nums[i] <= 10^9" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="font-body text-muted-foreground">TIME LIMIT (s)</Label>
                    <Input type="number" value={timeLimitSeconds} onChange={e => setTimeLimitSeconds(Number(e.target.value))} className="mt-1 bg-muted border-border font-mono" />
                  </div>
                  <div>
                    <Label className="font-body text-muted-foreground">MEMORY LIMIT (MB)</Label>
                    <Input type="number" value={memoryLimitMb} onChange={e => setMemoryLimitMb(Number(e.target.value))} className="mt-1 bg-muted border-border font-mono" />
                  </div>
                  <div>
                    <Label className="font-body text-muted-foreground">TAGS (comma-separated)</Label>
                    <Input value={tags} onChange={e => setTags(e.target.value)} className="mt-1 bg-muted border-border font-mono" placeholder="arrays, hash-table" />
                  </div>
                </div>

                {/* Test Cases */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-body text-muted-foreground">TEST CASES</Label>
                    <Button variant="outline" size="sm" onClick={addTestCase} className="font-heading text-xs"><Plus className="w-3 h-3 mr-1" />ADD</Button>
                  </div>
                  <div className="space-y-3">
                    {testCases.map((tc, i) => (
                      <div key={i} className="bg-muted/50 border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-heading text-xs text-muted-foreground">TEST #{i + 1}</span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground font-body cursor-pointer">
                              <input type="checkbox" checked={tc.is_hidden} onChange={e => updateTestCase(i, 'is_hidden', e.target.checked)} className="accent-primary" />
                              Hidden
                            </label>
                            {testCases.length > 1 && (
                              <Button variant="ghost" size="icon" onClick={() => removeTestCase(i)} className="h-6 w-6 text-destructive"><X className="w-3 h-3" /></Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground font-body">Input</Label>
                            <Textarea value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)} className="mt-1 bg-background border-border font-mono text-sm min-h-[60px]" placeholder="[2,7,11,15], 9" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground font-body">Expected Output</Label>
                            <Textarea value={tc.expected_output} onChange={e => updateTestCase(i, 'expected_output', e.target.value)} className="mt-1 bg-background border-border font-mono text-sm min-h-[60px]" placeholder="[0,1]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditor(false); resetForm(); }} className="font-heading tracking-wider">CANCEL</Button>
                  <Button onClick={saveProblem} className="font-heading tracking-wider glow-cyan"><Save className="w-4 h-4 mr-1" />SAVE PROBLEM</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewProblem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl overflow-y-auto">
            <div className="container mx-auto px-4 py-8 max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <Badge className={`${diffColor(previewProblem.difficulty)} border-0 font-heading`}>{previewProblem.difficulty.toUpperCase()}</Badge>
                <Button variant="ghost" size="icon" onClick={() => setPreviewProblem(null)}><X className="w-5 h-5" /></Button>
              </div>
              <h2 className="font-heading text-3xl text-foreground mb-4">{previewProblem.title}</h2>
              <div className="prose prose-invert max-w-none mb-6">
                <pre className="whitespace-pre-wrap font-body text-foreground/80 text-base leading-relaxed">{previewProblem.description}</pre>
              </div>
              {previewProblem.constraints && (
                <div className="mb-6">
                  <h3 className="font-heading text-sm text-muted-foreground mb-2">CONSTRAINTS</h3>
                  <pre className="font-mono text-sm text-foreground/70 bg-muted/50 rounded-lg p-4">{previewProblem.constraints}</pre>
                </div>
              )}
              <div>
                <h3 className="font-heading text-sm text-muted-foreground mb-2">EXAMPLE TEST CASES</h3>
                {((previewProblem.test_cases as unknown as TestCase[]) || []).filter(tc => !tc.is_hidden).map((tc, i) => (
                  <div key={i} className="bg-muted/50 rounded-lg p-4 mb-2 font-mono text-sm">
                    <div><span className="text-muted-foreground">Input:</span> <span className="text-foreground">{tc.input}</span></div>
                    <div><span className="text-muted-foreground">Output:</span> <span className="text-primary">{tc.expected_output}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match Creator Modal */}
      <AnimatePresence>
        {showMatchCreator && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl overflow-y-auto">
            <div className="container mx-auto px-4 py-8 max-w-3xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-heading text-2xl text-neon-magenta text-glow-magenta">CREATE MATCH</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowMatchCreator(false)}><X className="w-5 h-5" /></Button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-body text-muted-foreground">MAX PLAYERS</Label>
                    <Input type="number" value={matchMaxPlayers} onChange={e => setMatchMaxPlayers(Number(e.target.value))} min={2} max={8} className="mt-1 bg-muted border-border font-mono" />
                  </div>
                  <div>
                    <Label className="font-body text-muted-foreground">TIME LIMIT (minutes)</Label>
                    <Input type="number" value={matchTimeLimit} onChange={e => setMatchTimeLimit(Number(e.target.value))} min={10} max={120} className="mt-1 bg-muted border-border font-mono" />
                  </div>
                </div>

                <div>
                  <Label className="font-body text-muted-foreground mb-3 block">SELECT PROBLEMS ({selectedProblemIds.length} selected — need 5: 2E + 2M + 1H)</Label>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {problems.map(p => (
                      <div key={p.id} onClick={() => toggleProblemSelection(p.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                          selectedProblemIds.includes(p.id) ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30 border border-transparent hover:border-border'
                        }`}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedProblemIds.includes(p.id) ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                          {selectedProblemIds.includes(p.id) && <span className="text-primary-foreground text-xs">✓</span>}
                        </div>
                        <Badge className={`${diffColor(p.difficulty)} border-0 font-heading text-xs`}>{p.difficulty.toUpperCase()}</Badge>
                        <span className="font-heading text-foreground text-sm">{p.title}</span>
                      </div>
                    ))}
                    {problems.length === 0 && <p className="text-muted-foreground font-body text-sm text-center py-4">Create problems first!</p>}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowMatchCreator(false)} className="font-heading tracking-wider">CANCEL</Button>
                  <Button onClick={createMatch} disabled={creatingMatch || selectedProblemIds.length < 5} className="font-heading tracking-wider glow-magenta">
                    <Gamepad2 className="w-4 h-4 mr-1" />{creatingMatch ? 'CREATING...' : 'CREATE MATCH'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;
