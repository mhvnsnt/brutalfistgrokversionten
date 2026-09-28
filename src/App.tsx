import './engine/assets/installAssetStream';
import { TitleScreen } from './components/TitleScreen';
import { useState } from 'react';
import { useTapThroughGuard } from './pwa/useTapThroughGuard';
import { AppScreen } from './types';
import { BANNON_GLB_PLAYABLE_MODELS } from './data/bannonGlbRoster';
import { type BannonFighterProfile, getBannonFighter, getAllBannonFighters } from './data/bannonRoster';
import dynamic from 'next/dynamic';
import { useAuth } from './contexts/AuthContext';
import { type TournamentEndData } from './components/TournamentBracket';
import { type TournamentSettings, DEFAULT_TOURNAMENT_SETTINGS } from './components/TournamentSettingsScreen';
import { type StageId } from './engine/combat/StageConfig';

function ScreenShell() {
  return <div className="fixed inset-0 bg-[#0a0a0a]" />;
}

const CharacterSelect = dynamic(() => import('./components/CharacterSelect'), { ssr: false, loading: ScreenShell });
const GameBattleArena = dynamic(() => import('./components/GameBattleArena'), { ssr: false, loading: ScreenShell });
const TournamentBracket = dynamic(() => import('./components/TournamentBracket'), { ssr: false, loading: ScreenShell });
const TournamentStatsScreen = dynamic(() => import('./components/TournamentStatsScreen'), { ssr: false, loading: ScreenShell });
const TournamentBrowserScreen = dynamic(() => import('./components/TournamentBrowserScreen'), { ssr: false, loading: ScreenShell });
const AuthScreen = dynamic(() => import('./components/AuthScreen'), { ssr: false, loading: ScreenShell });
const PostTournamentScreen = dynamic(() => import('./components/PostTournamentScreen'), { ssr: false, loading: ScreenShell });
const PlayerProfileScreen = dynamic(() => import('./components/PlayerProfileScreen'), { ssr: false, loading: ScreenShell });
const TournamentSettingsScreen = dynamic(() => import('./components/TournamentSettingsScreen'), { ssr: false, loading: ScreenShell });
const LeaderboardScreen = dynamic(() => import('./components/LeaderboardScreen'), { ssr: false, loading: ScreenShell });
const PracticeArenaScreen = dynamic(() => import('./components/PracticeArenaScreen'), { ssr: false, loading: ScreenShell });
const StoryModeScreen = dynamic(() => import('./components/StoryModeScreen'), { ssr: false, loading: ScreenShell });
const StageSelectScreen = dynamic(() => import('./components/StageSelectScreen'), { ssr: false, loading: ScreenShell });
const SeasonalTournamentScreen = dynamic(() => import('./components/SeasonalTournamentScreen'), { ssr: false, loading: ScreenShell });
const MatchmakingQueueScreen = dynamic(() => import('./components/MatchmakingQueueScreen'), { ssr: false, loading: ScreenShell });
const SpectatorViewerScreen = dynamic(() => import('./components/SpectatorViewerScreen'), { ssr: false, loading: ScreenShell });
const AnimationTestArena = dynamic(() => import('./components/AnimationTestArena'), { ssr: false, loading: ScreenShell });
const MoveLibrary = dynamic(() => import('./components/MoveLibrary'), { ssr: false, loading: ScreenShell });
const PhotoBoothScreen = dynamic(() => import('./components/PhotoBoothScreen'), { ssr: false, loading: ScreenShell });
const ConceptArtGallery = dynamic(() => import('./components/ConceptArtGallery'), { ssr: false, loading: ScreenShell });
const PreCombatValidationScreen = dynamic(() => import('./components/PreCombatValidationScreen'), { ssr: false, loading: ScreenShell });

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [screen, setScreen] = useState<AppScreen>(AppScreen.Title);
  // A tap must not press the screen it opens — see useTapThroughGuard. Without
  // this, PRESS START's own synthesised click landed on whichever mode button
  // the menu drew at that pixel.
  useTapThroughGuard(screen);
  const [p1BannonFighter, setP1BannonFighter] = useState<BannonFighterProfile | null>(null);
  const [p2BannonFighter, setP2BannonFighter] = useState<BannonFighterProfile | null>(null);
  const [matchWinner, setMatchWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [gameMode, setGameMode] = useState<'arcade' | 'versus' | 'tournament'>('versus');
  const [tournamentEndData, setTournamentEndData] = useState<TournamentEndData | null>(null);
  const [tournamentSettings, setTournamentSettings] = useState<TournamentSettings>(DEFAULT_TOURNAMENT_SETTINGS);
  const [selectedStageId, setSelectedStageId] = useState<StageId>('urban_night');

  if (!BANNON_GLB_PLAYABLE_MODELS?.length) {
    return (
      <div className="bf-stage fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xs tracking-[0.4em] text-[var(--color-muted)]">ROSTER LOCKED</div>
          <div className="bf-display mt-3 text-4xl">NO VALID FIGHTERS</div>
        </div>
      </div>
    );
  }

  // ── Auth loading ──
  if (authLoading) {
    return (
      <div className="bf-stage fixed inset-0 flex items-center justify-center">
        <div className="bf-display text-5xl">BRUTAL FIST</div>
      </div>
    );
  }

  // ── Boot ──
  if (screen === AppScreen?.Boot) {
    return (
      <div className="bf-stage fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="bf-display text-6xl">BRUTAL FIST</div>
        </div>
      </div>
    );
  }

  // ── Title ──
  if (screen === AppScreen?.Title) {
    return <TitleScreen onStart={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Main Menu ──
  if (screen === AppScreen?.MainMenu) {
    return (
      <div className="bf-menu fixed inset-0 flex items-center justify-center p-safe">
        <div className="w-[min(92vw,440px)] mobile-menu-scroll pb-8">
          <div className="mb-4">
            <div className="text-xs tracking-[0.42em] text-[var(--color-muted)]">UNDERGROUND CIRCUIT</div>
            <div className="bf-display text-6xl">BRUTAL FIST</div>
          </div>
          {user && (
            <div className="mb-6 flex items-center justify-between">
              <div className="text-[8px] tracking-widest text-zinc-600">
                PLAYER: <span className="text-zinc-400">{(user.email ?? '').split('@')[0].toUpperCase()}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="text-[7px] tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors border border-zinc-800 px-2 py-1"
              >
                SIGN OUT
              </button>
            </div>
          )}
          <div className="space-y-2">
            <button
              onClick={() => { setGameMode('arcade'); setScreen(AppScreen?.Select); }}
              className="bf-item"
            >
              ARCADE
            </button>
            <button
              onClick={() => { setGameMode('versus'); setScreen(AppScreen?.Select); }}
              className="bf-item"
            >
              VERSUS
            </button>
            <button
              onClick={() => { setGameMode('tournament'); setScreen('tournament_browser' as any); }}
              className="bf-item"
            >
              TOURNAMENT
              <span>BRACKET MODE</span>
            </button>
            <button
              onClick={() => setScreen('seasonal_tournament' as any)}
              className="bf-item"
            >
              SEASONAL
              <span>ELO BRACKET</span>
            </button>
            <button
              onClick={() => {
                if (!user) { setScreen('auth' as any); }
                else { setScreen('matchmaking_queue' as any); }
              }}
              className="bf-item"
            >
              RANKED QUEUE
              <span>LIVE MATCHMAKING</span>
            </button>
            <button
              onClick={() => setScreen('spectator' as any)}
              className="bf-item"
            >
              SPECTATE
              <span>LIVE MATCHES</span>
            </button>
            <button
              onClick={() => setScreen('practice' as any)}
              className="bf-item"
            >
              TRAINING
              <span>PRACTICE ARENA</span>
            </button>
            <button
              onClick={() => setScreen('photo_booth' as any)}
              className="bf-item"
            >
              PHOTO BOOTH
              <span>CONCEPT + PIXEL</span>
            </button>
            <button
              onClick={() => setScreen('art_book' as any)}
              className="bf-item"
            >
              ART BOOK
              <span>HQ vs SPRITE</span>
            </button>
            <button
              onClick={() => setScreen('move_library' as any)}
              className="bf-item"
            >
              MOVE LIBRARY
              <span>EVERY CLIP · LABEL THEM</span>
            </button>
            <button
              onClick={() => setScreen('anim_test_arena' as any)}
              className="bf-item"
            >
              ANIM TEST
              <span>MOVESET CREATION</span>
            </button>
            <button
              onClick={() => setScreen('story' as any)}
              className="bf-item"
            >
              STORY
              <span>CHARACTER ARCS</span>
            </button>
            <button
              onClick={() => setScreen('leaderboard' as any)}
              className="bf-item"
            >
              LEADERBOARD
              <span>GLOBAL RANKS</span>
            </button>
            <button
              onClick={() => {
                if (!user) { setScreen('auth' as any); }
                else { setScreen('stats' as any); }
              }}
              className="bf-item"
            >
              STATS
              <span>RECORDS & RANK</span>
            </button>
            <button
              onClick={() => {
                if (!user) { setScreen('auth' as any); }
                else { setScreen('profile' as any); }
              }}
              className="bf-item"
            >
              PROFILE
              <span>MASTERY & COSMETICS</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if ((screen as any) === 'photo_booth') {
    return <PhotoBoothScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  if ((screen as any) === 'art_book') {
    return <ConceptArtGallery onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Move Library ──
  // Every baked clip, playable, with somewhere to write down what it is.
  // This project keeps hitting "I cannot tell what this move is"; the answer
  // is that a human has to look, so this is where he looks.
  if ((screen as any) === 'move_library') {
    return <MoveLibrary onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Animation Test Arena ──
  if ((screen as any) === 'anim_test_arena') {
    return <AnimationTestArena onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Pre-Combat Validation ──
  if ((screen as any) === 'pre_combat_validation') {
    const p1 = p1BannonFighter ?? getBannonFighter('bannon')!;
    const p2 = p2BannonFighter ?? getBannonFighter('maime')!;
    return (
      <PreCombatValidationScreen
        p1Fighter={p1}
        p2Fighter={p2}
        onCombatApproved={() => setScreen(AppScreen?.Combat)}
        onBack={() => setScreen('stage_select' as any)}
      />
    );
  }

  // ── Auth Screen ──
  if ((screen as any) === 'auth') {
    return <AuthScreen onSuccess={() => setScreen('stats' as any)} />;
  }

  // ── Tournament Browser ──
  if ((screen as any) === 'tournament_browser') {
    return <TournamentBrowserScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Tournament Settings (pre-entry) ──
  if ((screen as any) === 'tournament_settings') {
    return (
      <TournamentSettingsScreen
        initialSettings={tournamentSettings}
        onBack={() => setScreen(AppScreen?.MainMenu)}
        onConfirm={(s) => {
          setTournamentSettings(s);
          setScreen('tournament_browser' as any);
        }}
      />
    );
  }

  // ── Seasonal Tournament ──
  if ((screen as any) === 'seasonal_tournament') {
    return (
      <SeasonalTournamentScreen
        onBack={() => setScreen(AppScreen?.MainMenu)}
        playerFighterId={p1BannonFighter?.id ?? 'bannon'}
      />
    );
  }

  // ── Leaderboard ──
  if ((screen as any) === 'leaderboard') {
    return <LeaderboardScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Spectator Viewer ──
  if ((screen as any) === 'spectator') {
    return <SpectatorViewerScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Practice Arena ──
  if ((screen as any) === 'practice') {
    return <PracticeArenaScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Story Mode ──
  if ((screen as any) === 'story') {
    return (
      <StoryModeScreen
        onBack={() => setScreen(AppScreen?.MainMenu)}
        onStartStoryBattle={(p1f, p2f, chapterTitle) => {
          setP1BannonFighter(p1f);
          setP2BannonFighter(p2f);
          setScreen('stage_select' as any);
        }}
        onCosmeticUnlock={(characterId, reward) => {
          // Cosmetic unlock handled inside StoryModeScreen with banner
          // Future: persist to Supabase profile here
          console.info('[BrutalFist] Cosmetic unlocked:', reward.name, 'for', characterId);
        }}
      />
    );
  }

  // ── Stage Select ──
  if ((screen as any) === 'stage_select') {
    const p1 = p1BannonFighter ?? getBannonFighter('bannon')!;
    const p2 = p2BannonFighter ?? getBannonFighter('maime')!;
    return (
      <StageSelectScreen
        p1Fighter={p1}
        p2Fighter={p2}
        onConfirm={(stageId) => {
          setSelectedStageId(stageId);
          setScreen(AppScreen.Combat);
        }}
        onBack={() => setScreen(AppScreen?.Select)}
      />
    );
  }

  // ── Tournament Stats (auth-gated) ──
  if ((screen as any) === 'stats') {
    if (!user) return <AuthScreen onSuccess={() => setScreen('stats' as any)} />;
    return <TournamentStatsScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Player Profile Screen ──
  if ((screen as any) === 'profile') {
    if (!user) return <AuthScreen onSuccess={() => setScreen('profile' as any)} />;
    return <PlayerProfileScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Post Tournament Screen ──
  if ((screen as any) === 'post_tournament' && tournamentEndData) {
    return (
      <PostTournamentScreen
        playerFighter={tournamentEndData.playerFighter}
        results={tournamentEndData.results}
        stats={tournamentEndData.stats}
        isChampion={tournamentEndData.isChampion}
        rankPointsEarned={tournamentEndData.rankPointsEarned}
        rankTier={tournamentEndData.rankTier}
        onMainMenu={() => { setTournamentEndData(null); setScreen(AppScreen?.MainMenu); }}
        onPlayAgain={() => { setTournamentEndData(null); setScreen('tournament_browser' as any); }}
      />
    );
  }

  // ── Character Select ──
  if (screen === AppScreen?.Select) {
    return (
      <CharacterSelect
        onStartMatch={(p1f, p2f) => {
          setP1BannonFighter(p1f);
          setP2BannonFighter(p2f);
          if (gameMode === 'tournament') {
            setScreen('tournament' as any);
          } else {
            // Go to stage select before combat
            setScreen('stage_select' as any);
          }
        }}
      />
    );
  }

  // ── Tournament Bracket ──
  if ((screen as any) === 'tournament') {
    const player = p1BannonFighter ?? getBannonFighter('bannon')!;
    return (
      <TournamentBracket
        playerFighter={player}
        onExit={() => setScreen(AppScreen?.MainMenu)}
        onTournamentEnd={(data) => {
          setTournamentEndData(data);
          setScreen('post_tournament' as any);
        }}
      />
    );
  }

  // ── Game Battle Arena ──
  if (screen === AppScreen?.Combat) {
    const p1 = p1BannonFighter ?? getBannonFighter('bannon')!;
    const p2 = p2BannonFighter ?? getBannonFighter('maime')!;
    return (
      <GameBattleArena
        p1Fighter={p1}
        p2Fighter={p2}
        onMatchEnd={(winner) => {
          setMatchWinner(winner);
          setScreen(AppScreen?.PostMatch);
        }}
        onBack={() => setScreen('stage_select' as any)}
        settings={tournamentSettings}
        stageId={selectedStageId}
      />
    );
  }

  // ── Post Match ──
  if (screen === AppScreen?.PostMatch) {
    const p1 = p1BannonFighter ?? getBannonFighter('bannon')!;
    const p2 = p2BannonFighter ?? getBannonFighter('maime')!;
    const winnerName = matchWinner === 'p1' ? p1.name : matchWinner === 'p2' ? p2.name : null;
    return (
      <div className="bf-stage fixed inset-0 flex flex-col items-center justify-center gap-6">
        <div className="text-xs tracking-[0.42em] text-[var(--color-muted)]">MATCH COMPLETE</div>
        {winnerName ? (
          <div className="bf-display text-5xl">{winnerName.toUpperCase()} WINS</div>
        ) : (
          <div className="bf-display text-5xl">DRAW</div>
        )}
        <div className="flex gap-3 mt-2">
          <button onClick={() => setScreen('stage_select' as any)} className="bf-fight">REMATCH</button>
          <button onClick={() => setScreen(AppScreen?.MainMenu)} className="bf-item w-auto px-5">MAIN MENU</button>
        </div>
      </div>
    );
  }

  // ── VS screen (legacy fallback) ──
  if (screen === AppScreen?.VS) {
    const p1 = p1BannonFighter;
    const p2 = p2BannonFighter;
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono overflow-hidden">
        <div className="w-full px-8 flex items-center justify-between">
          <div className="text-3xl md:text-6xl font-black italic">{p1?.name ?? 'P1'}</div>
          <div className="text-4xl md:text-7xl font-black text-red-500">VS</div>
          <div className="text-right text-3xl md:text-7xl font-black italic text-slate-500">{p2?.name ?? 'P2'}</div>
        </div>
      </div>
    );
  }

  // ── Matchmaking Queue ──
  if ((screen as any) === 'matchmaking_queue') {
    if (!user) return <AuthScreen onSuccess={() => setScreen('matchmaking_queue' as any)} />;
    return (
      <MatchmakingQueueScreen
        onBack={() => setScreen(AppScreen?.MainMenu)}
        onMatchFound={(opponentFighterId, _opponentFighterName) => {
          const fighter = getBannonFighter(opponentFighterId);
          if (fighter) setP2BannonFighter(fighter);
          setScreen('stage_select' as any);
        }}
      />
    );
  }

  return <ScreenShell />;
}
