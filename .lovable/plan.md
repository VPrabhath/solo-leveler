

# ⚔️ CodeArena — Real-Time Competitive Coding Platform

## Overview
A high-intensity, esports-themed competitive coding platform where players compete in real-time to solve 5 coding problems. Dark cyberpunk aesthetic, dopamine-driven feedback loops, and persistent ELO rankings.

---

## Phase 1: Foundation & Auth

### User Authentication & Profiles
- Email + GitHub OAuth sign-up/login
- Player profiles with: username, avatar, country flag, ELO rating, match history
- Rank tiers (Bronze → Diamond → Legendary) with animated rank badges

### Database Schema
- `profiles` — username, avatar, country, elo_rating, total_matches, wins
- `user_roles` — admin/player roles (secure, separate table)
- `problems` — title, description, difficulty, test_cases, constraints, time_limit
- `matches` — status, start_time, problem_set, max_players
- `match_participants` — player_id, match_id, score, rank, submissions
- `submissions` — player_id, problem_id, code, language, result, time_taken

---

## Phase 2: Admin Panel — Problem Management

### Problem Creator Dashboard (Admin only)
- Create/edit problems with title, description, difficulty (Easy/Medium/Hard)
- Add test cases (input/output pairs, hidden vs visible)
- Set time limits and memory constraints
- Tag problems by topic (arrays, DP, graphs, etc.)
- Preview problem as player would see it

---

## Phase 3: Core Arena Experience

### Lobby & Matchmaking
- Live lobby showing players waiting with avatars, ranks, and country flags
- Real-time player count using Supabase Realtime channels
- Dramatic 5-second countdown with pulsing neon animations before match starts
- Match starts when enough players join (2-8 players)

### The Arena — In-Match Experience
- **Split-screen layout**: Problem description (left) + Code editor (right)
- **5 problems**: 2 Easy → 2 Medium → 1 Hard (sequential unlock)
- Hard problem only unlocks after solving ≥3 problems
- Built-in code editor with syntax highlighting (Monaco Editor)
- Language selector (JavaScript, Python, C++)

### Timer & Pressure Mechanics
- Prominent countdown timer (e.g., 45 minutes total)
- Timer changes color: green → yellow → orange → red → pulsing red
- Final 60 seconds: screen border glows red, subtle shake

### Live Leaderboard
- Real-time scoreboard sidebar showing all players' progress
- Score updates via Supabase Realtime
- Rank position fluctuates with animations
- Show solve times and problem completion status per player

### Submission Feedback
- **Correct**: Green flash, score pop-up animation, streak counter increment
- **Wrong**: Red pulse, screen micro-shake, "Almost there — 4/5 test cases passed" messaging
- Partial scoring: points awarded per test case passed (keeps hope alive)
- Streak bonuses: 2x, 3x multiplier for consecutive correct submissions

---

## Phase 4: Code Execution

### Edge Function for Code Execution
- Supabase Edge Function that receives code + test cases
- For V1: execute JavaScript/Python via a controlled evaluation approach
- Rate limiting to prevent abuse
- Timeout enforcement per submission
- Returns: pass/fail per test case, execution time, memory usage

---

## Phase 5: Post-Match & Progression

### Post-Match Screen
- ELO rating change displayed with dramatic animation (+/- rating)
- "You were 1 test case away from Top 3" personalized near-miss messaging
- Match stats: problems solved, time taken, accuracy percentage
- Compare with lobby average and top performer
- **"Queue Again" button** — prominent, immediate, no cooldown

### Player Profile & History
- Match history with detailed breakdowns
- Rating graph over time (using Recharts)
- Problem-solving stats by difficulty
- Current rank tier with progress bar to next tier

---

## Phase 6: Visual & UX Polish

### Cyberpunk / Esports Theme
- Dark background with subtle animated grid/particle effects
- Neon accent colors (cyan, magenta, electric blue)
- Glowing buttons with hover effects
- Futuristic font styling for headings
- Player cards with animated borders based on rank

### Animations & Micro-interactions
- Fade-in and scale animations on page transitions
- Keystroke micro-feedback in editor (subtle glow)
- Score pop-ups with physics-based animations
- Countdown with dramatic scaling numbers
- Rank change reveal with suspenseful delay

### Responsive Design
- Desktop: full split-screen arena layout
- Mobile: tabbed view (problem / editor / leaderboard)

---

## Monetization Ideas (Non Pay-to-Win)
- Custom editor themes and color schemes
- Animated profile borders and avatars
- Victory celebration animations
- Username effects (glow, colors)

---

## Technical Notes
- **Frontend**: React + Tailwind + Monaco Editor
- **Backend**: Supabase (Auth, Database, Realtime, Edge Functions)
- **Real-time**: Supabase Realtime channels for lobby, leaderboard, match state
- **Code Execution**: Edge function with sandboxed eval (V1), expandable to external judge service later
- **Anti-cheat**: Rate limiting, submission cooldowns, server-side validation

