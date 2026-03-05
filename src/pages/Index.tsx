import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Swords, Trophy, Users, Zap, ChevronRight, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      icon: <Swords className="w-8 h-8" />,
      title: 'REAL-TIME BATTLES',
      desc: 'Compete head-to-head against live opponents. Solve 5 problems under pressure.',
    },
    {
      icon: <Trophy className="w-8 h-8" />,
      title: 'ELO RANKINGS',
      desc: 'Climb from Bronze to Legendary. Every match changes your rank.',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'LIVE LOBBIES',
      desc: 'See opponents join in real-time. Know who you\'re up against.',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'STREAK BONUSES',
      desc: 'Chain correct submissions for 2x, 3x multipliers. Momentum is everything.',
    },
  ];

  const ranks = [
    { name: 'Bronze', color: 'text-orange-400', elo: '0-999' },
    { name: 'Silver', color: 'text-gray-300', elo: '1000-1399' },
    { name: 'Gold', color: 'text-yellow-400', elo: '1400-1799' },
    { name: 'Diamond', color: 'text-neon-cyan', elo: '1800-2199' },
    { name: 'Legendary', color: 'text-neon-magenta', elo: '2200+' },
  ];

  return (
    <div className="min-h-screen bg-background cyber-grid animate-grid-scroll scanline overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6 text-primary" />
            <span className="font-heading font-bold text-xl text-primary text-glow-cyan">CODEARENA</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button
                onClick={() => navigate('/lobby')}
                className="font-heading tracking-wider glow-cyan"
              >
                ENTER ARENA
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/auth')}
                  className="font-heading tracking-wider text-muted-foreground"
                >
                  SIGN IN
                </Button>
                <Button
                  onClick={() => navigate('/auth')}
                  className="font-heading tracking-wider glow-cyan"
                >
                  JOIN NOW
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-body mb-6">
              <Shield className="w-4 h-4" />
              COMPETITIVE CODING REDEFINED
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading font-black leading-tight mb-6">
              <span className="text-foreground">CODE.</span>
              <br />
              <span className="text-primary text-glow-cyan">COMPETE.</span>
              <br />
              <span className="text-neon-magenta text-glow-magenta">CONQUER.</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground font-body max-w-2xl mx-auto mb-10">
              Real-time coding battles. Live leaderboards. ELO rankings.
              This isn't practice — this is <span className="text-primary">war</span>.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => navigate(user ? '/lobby' : '/auth')}
                className="h-14 px-10 text-lg font-heading tracking-widest glow-cyan"
              >
                {user ? 'ENTER ARENA' : 'START FIGHTING'}
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="bg-card/50 backdrop-blur border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300 group"
              >
                <div className="text-primary mb-4 group-hover:text-glow-cyan transition-all">
                  {feat.icon}
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground mb-2">
                  {feat.title}
                </h3>
                <p className="text-muted-foreground font-body text-sm">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ranks */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4">
            RANK <span className="text-primary text-glow-cyan">TIERS</span>
          </h2>
          <p className="text-muted-foreground font-body mb-12 max-w-lg mx-auto">
            Every match matters. Climb the ladder or get left behind.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {ranks.map((rank, i) => (
              <motion.div
                key={rank.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="bg-card/50 border border-border rounded-lg px-6 py-4 min-w-[140px]"
              >
                <div className={`font-heading font-bold text-lg ${rank.color}`}>
                  {rank.name}
                </div>
                <div className="text-muted-foreground font-mono text-xs mt-1">
                  {rank.elo}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="bg-card/50 border border-primary/20 rounded-xl p-12 glow-cyan max-w-2xl mx-auto">
            <h2 className="text-3xl font-heading font-bold text-primary text-glow-cyan mb-4">
              READY TO PROVE YOURSELF?
            </h2>
            <p className="text-muted-foreground font-body mb-8">
              Join thousands of warriors in the arena. No excuses.
            </p>
            <Button
              size="lg"
              onClick={() => navigate(user ? '/lobby' : '/auth')}
              className="h-14 px-10 text-lg font-heading tracking-widest glow-cyan"
            >
              {user ? 'ENTER ARENA' : 'ENLIST NOW'}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" />
            <span className="font-heading text-sm text-muted-foreground">CODEARENA</span>
          </div>
          <span className="text-muted-foreground font-body text-sm">
            © 2026 CodeArena. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
