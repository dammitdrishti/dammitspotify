import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Music, LogIn, ArrowLeft, Zap, Moon, Clock, Smile, Frown, Download, Check, BarChart3, Flame, Loader2, Eye
} from 'lucide-react';

import { 
  redirectToAuthCodeFlow, getAccessToken, fetchTopTracks, fetchAudioFeatures 
} from './services/spotifyService';

import { AppView, SpotifyTrack, VibeMode } from './types';

// ================= STYLES INJECTION =================
// Adds the specific Glassmorphism effects without breaking Tailwind
const GLOBAL_STYLES = `
  /* Custom Scrollbar for glass lists */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 10px; }

  /* Vintage Grunge Background for the Poster */
  .vintage-bg {
    background-image: url('https://i.ibb.co/f2FygQj/image-1.png');
    background-size: cover;
    background-position: center;
  }

  /* Glass Container for the Poster */
  .poster-glass {
    background: rgba(0, 0, 0, 0.3); 
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 40px 80px rgba(0,0,0,0.6);
  }
`;

const App = () => {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<AppView>(AppView.LOGIN);
    
  const [candidates, setCandidates] = useState<SpotifyTrack[]>([]); 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); 
  const [finalTracks, setFinalTracks] = useState<SpotifyTrack[]>([]); 
  const [vibeBuckets, setVibeBuckets] = useState<Record<string, SpotifyTrack[]>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState('');
    
  const effectRan = useRef(false);

  // --- Auth Flow ---
  useEffect(() => {
    if (effectRan.current === true) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      effectRan.current = true;
      window.history.replaceState({}, document.title, "/");
      getAccessToken(code)
        .then((accessToken) => {
          setToken(accessToken);
          setView(AppView.DASHBOARD);
        })
        .catch((err) => {
          console.error("Auth Error:", err);
          setError("Login failed. Please try again.");
        });
    }
  }, []);

  const handleLogin = async () => await redirectToAuthCodeFlow();
  const logout = () => {
    setToken(null);
    localStorage.removeItem('verifier');
    setView(AppView.LOGIN);
  };

  const startSelection = (tracks: SpotifyTrack[], title: string, isTimeline = false) => {
    const limit = isTimeline ? 50 : 25;
    setCandidates(tracks.slice(0, limit));
    setSelectedIds(new Set()); 
    setResultTitle(title);
    setView(AppView.SELECTION); 
  };

  // --- 1. Your Eras (Chronology) ---
  const handleYourEras = async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const tracks = await fetchTopTracks(token, 50, 'long_term');
        
      const sorted = tracks.sort((a: any, b: any) => 
        a.album.release_date.localeCompare(b.album.release_date)
      );

      const phasedTracks = sorted.map((t, index) => ({
          ...t,
          phase: index < sorted.length / 3 ? 1 : index < (2 * sorted.length) / 3 ? 2 : 3
      }));

      startSelection(phasedTracks, 'Your Eras', true);
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  // --- 2. Gatekeeper Score (Underrated) ---
  const handleGatekeeper = async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const allTracks = await fetchTopTracks(token, 50, 'long_term');
      const sorted = allTracks.sort((a, b) => a.popularity - b.popularity);
      startSelection(sorted.slice(0, 25), 'Gatekeeper Score');
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  // --- 3. Sonic Aura (Vibe Check) ---
  const handleSonicAura = async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const allTracks = await fetchTopTracks(token, 50, 'long_term');
        
      if (allTracks.length === 0) throw new Error("No listening history found.");

      const trackIds = allTracks.map(t => t.id);
      const features = await fetchAudioFeatures(token, trackIds);
      const featuresMap = new Map(features.filter(f => f).map(f => [f.id, f]));

      const getFeat = (track: any) => featuresMap.get(track.id) || { energy: 0, valence: 0, danceability: 0, tempo: 0 };

      let availableTracks = [...allTracks];
      const picks: Record<string, SpotifyTrack[]> = {};

      const pickWinner = (vibe: string, sortFn: ((a: any, b: any) => number) | null) => {
        let winner;
        if (sortFn === null) {
            winner = availableTracks[0];
        } else {
            const sorted = [...availableTracks].sort(sortFn);
            winner = sorted[0];
        }
          
        if (winner) {
          picks[vibe] = [winner];
          availableTracks = availableTracks.filter(t => t.id !== winner.id);
        } else {
          picks[vibe] = [];
        }
      };

      pickWinner(VibeMode.DOOMSCROLLING, null);
      pickWinner(VibeMode.TIME_TRAVELER, (a, b) => a.album.release_date.localeCompare(b.album.release_date));
      pickWinner(VibeMode.VILLAIN, (a, b) => {
        const scoreA = getFeat(a).energy - getFeat(a).valence;
        const scoreB = getFeat(b).energy - getFeat(b).valence;
        return scoreB - scoreA;
      });
      pickWinner(VibeMode.BEAST, (a, b) => getFeat(b).energy - getFeat(a).energy);
      pickWinner(VibeMode.LATE_NIGHT, (a, b) => getFeat(b).danceability - getFeat(a).danceability);
      pickWinner(VibeMode.MAIN_CHAR, (a, b) => getFeat(b).valence - getFeat(a).valence);

      setVibeBuckets(picks);
      setView(AppView.VIBE_INITIAL_CHOOSE);

    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const handleSelectSingleVibeAndFinish = (vibeId: string) => {
      const track = vibeBuckets[vibeId]?.[0];
      if (track) {
          setFinalTracks([track]);
          setResultTitle(`${vibeId}`);
          setView(AppView.RESULTS);
      }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else {
      if (newSet.size >= 10) return; 
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const confirmSelection = () => {
    const selectedTracks = candidates.filter(t => selectedIds.has(t.id));
    setFinalTracks(selectedTracks);
    setView(AppView.RESULTS);
  };

  const handleError = (err: any) => {
    console.error(err);
    setError(err.message || 'Failed to fetch data.');
    if (err.message === 'Login failed.') logout();
  };

  if (view === AppView.LOGIN) return <LoginView error={error} loading={loading} onLogin={handleLogin} />;
    
  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-12 text-white font-sans relative overflow-x-hidden">
      <style>{GLOBAL_STYLES}</style>
      
      {/* Background for non-result views */}
      {view !== AppView.RESULTS && (
         <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#000000_100%)] pointer-events-none"></div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto">
        <Header logout={logout} />
        {loading && <LoadingOverlay />}
        {error && <ErrorBanner message={error} />}

        {view === AppView.DASHBOARD && (
            <Dashboard 
            onYourEras={handleYourEras}
            onGatekeeper={handleGatekeeper}
            onSonicAura={handleSonicAura}
            />
        )}

        {view === AppView.VIBE_INITIAL_CHOOSE && (
            <VibeInitialChooseView
                onSelectVibe={handleSelectSingleVibeAndFinish}
                onRevealAll={() => setView(AppView.VIBE_MENU)}
                onBack={() => setView(AppView.DASHBOARD)}
            />
        )}

        {view === AppView.VIBE_MENU && (
            <VibeMenuView 
                buckets={vibeBuckets} 
                onSelect={handleSelectSingleVibeAndFinish} 
                onBack={() => setView(AppView.VIBE_INITIAL_CHOOSE)} 
            />
        )}

        {view === AppView.SELECTION && (
            <SelectionView 
            title={resultTitle}
            candidates={candidates}
            selectedIds={selectedIds}
            onToggle={toggleSelection}
            onConfirm={confirmSelection}
            onBack={() => setView(AppView.DASHBOARD)}
            />
        )}

        {view === AppView.RESULTS && (
            <ResultsView 
            title={resultTitle}
            tracks={finalTracks}
            onBack={() => setView(AppView.DASHBOARD)}
            />
        )}
      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const LoginView = ({ error, loading, onLogin }: any) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 relative">
    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/20"><Music className="w-8 h-8 text-black" /></div>
    <h1 className="text-5xl font-black mb-8 tracking-tighter">dammitspotifywrapped</h1>
    <button onClick={onLogin} disabled={loading} className="flex items-center gap-2 bg-green-500 text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform">
       {loading ? <Loader2 className="animate-spin" /> : <LogIn className="w-5 h-5" />}
       {loading ? "Connecting..." : "Log in with Spotify"}
    </button>
    {error && <p className="text-red-500 mt-4 bg-red-900/20 px-4 py-2 rounded">{error}</p>}
  </div>
);

const Header = ({ logout }: any) => (
  <header className="flex justify-between items-center mb-8">
    <div className="flex items-center gap-2"><Music className="text-green-500" /> <b className="tracking-tight">dammitspotifywrapped</b></div>
    <button onClick={logout} className="text-zinc-400 hover:text-white">Log out</button>
  </header>
);

const LoadingOverlay = () => <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 flex-col gap-4"><Loader2 className="animate-spin text-green-500 w-12 h-12"/><p className="text-green-500 animate-pulse">Analyzing Library...</p></div>;
const ErrorBanner = ({message}: any) => <div className="bg-red-900/50 text-red-200 p-4 rounded mb-6 text-center">{message}</div>;

// UPDATED DASHBOARD: Uses your original Images but with Glassmorphism Overlay styling
const Dashboard = ({ onYourEras, onGatekeeper, onSonicAura }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
    <ImageCard onClick={onYourEras} imageSrc="/spot1.jpg" title="Your Eras" description="Travel through your musical history." />
    <ImageCard onClick={onGatekeeper} imageSrc="/spot2.jpg" title="Gatekeeper Score" description="How unique is your music taste?" />
    <ImageCard onClick={onSonicAura} imageSrc="/spot3.jpg" title="Sonic Aura" description="Discover your true musical vibe." />
  </div>
);

// UPDATED IMAGE CARD: Frosted Glass Bottom + Lift Effect
const ImageCard = ({ onClick, imageSrc, title, description }: any) => (
  <div onClick={onClick} className="relative h-[480px] rounded-[2rem] overflow-hidden cursor-pointer group shadow-2xl shadow-black/70 transition-transform duration-500 hover:scale-[1.02] hover:-translate-y-2 border border-white/10">
    <img src={imageSrc} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
    
    {/* Glass Bottom Overlay */}
    <div className="absolute bottom-0 left-0 width-full w-full p-6 pb-8 bg-gradient-to-b from-transparent via-black/80 to-black/95 backdrop-blur-[2px]">
      <h3 className="text-3xl font-black text-white mb-2 tracking-wide uppercase drop-shadow-md">{title}</h3>
      <p className="text-zinc-200 text-sm font-medium">{description}</p>
    </div>
  </div>
);

const VibeInitialChooseView = ({ onSelectVibe, onRevealAll, onBack }: any) => {
    const vibes = [
        { id: VibeMode.BEAST, icon: <Flame className="w-5 h-5" />, color: 'red', desc: 'Highest Energy (Motivation)' },
        { id: VibeMode.MAIN_CHAR, icon: <Smile className="w-5 h-5" />, color: 'pink', desc: 'Highest Valence (Happiness)' },
        { id: VibeMode.VILLAIN, icon: <Zap className="w-5 h-5" />, color: 'orange', desc: 'High Energy + Low Valence (Angry)' },
        { id: VibeMode.LATE_NIGHT, icon: <Moon className="w-5 h-5" />, color: 'indigo', desc: 'Highest Danceability' },
        { id: VibeMode.DOOMSCROLLING, icon: <Frown className="w-5 h-5" />, color: 'gray', desc: 'Heard for hours on loop' },
        { id: VibeMode.TIME_TRAVELER, icon: <Clock className="w-5 h-5" />, color: 'cyan', desc: 'Oldest Release Date' },
    ];

    return (
        <div className="animate-in fade-in">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 bg-zinc-900 rounded-full"><ArrowLeft /></button>
                <div>
                    <h2 className="text-3xl font-bold">Which Vibe defines you?</h2>
                    <p className="text-zinc-400">Choose one to reveal your anthem, or see them all.</p>
                </div>
            </div>
             
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vibes.map((v) => (
                    <div key={v.id} onClick={() => onSelectVibe(v.id)} className={`relative overflow-hidden bg-zinc-900/50 border border-zinc-800 hover:border-${v.color}-500/50 hover:bg-zinc-900 rounded-2xl p-6 transition-all cursor-pointer group h-48 flex flex-col justify-between`}>
                        <div className={`p-3 rounded-xl bg-zinc-950/50 w-fit text-${v.color}-400`}>{v.icon}</div>
                        <div>
                            <h3 className={`text-xl font-bold mb-1 group-hover:text-${v.color}-400 transition-colors`}>{v.id}</h3>
                            <p className="text-sm text-zinc-400">{v.desc}</p>
                        </div>
                    </div>
                ))}
                
                <div onClick={onRevealAll} className="relative overflow-hidden bg-gradient-to-br from-green-900/30 to-zinc-900/50 border border-green-500/30 hover:border-green-500 hover:from-green-900/50 rounded-2xl p-6 transition-all cursor-pointer group h-48 flex flex-col justify-center items-center text-center col-span-full md:col-span-1 lg:col-span-3">
                        <div className="p-4 rounded-full bg-green-500/20 text-green-400 mb-4 group-hover:scale-110 transition-transform"><Eye className="w-8 h-8"/></div>
                        <h3 className="text-2xl font-bold mb-2 text-white">Reveal All Vibes & Songs</h3>
                        <p className="text-sm text-green-200/70">See your entire sonic profile at once.</p>
                </div>
            </div>
        </div>
    );
};

const VibeMenuView = ({ buckets, onSelect, onBack }: any) => {
    const vibes = [
        { id: VibeMode.BEAST, icon: <Flame className="w-5 h-5" />, color: 'red', desc: 'Highest Energy (Motivation)' },
        { id: VibeMode.MAIN_CHAR, icon: <Smile className="w-5 h-5" />, color: 'pink', desc: 'Highest Valence (Happiness)' },
        { id: VibeMode.VILLAIN, icon: <Zap className="w-5 h-5" />, color: 'orange', desc: 'High Energy + Low Valence (Angry)' },
        { id: VibeMode.LATE_NIGHT, icon: <Moon className="w-5 h-5" />, color: 'indigo', desc: 'Highest Danceability' },
        { id: VibeMode.DOOMSCROLLING, icon: <Frown className="w-5 h-5" />, color: 'gray', desc: 'Heard for hours on loop' },
        { id: VibeMode.TIME_TRAVELER, icon: <Clock className="w-5 h-5" />, color: 'cyan', desc: 'Oldest Release Date' },
    ];

    return (
        <div className="animate-in fade-in">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 bg-zinc-900 rounded-full"><ArrowLeft /></button>
                <h2 className="text-3xl font-bold">Your Full Sonic Profile</h2>
            </div>
             
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vibes.map((v) => {
                    const topSong = buckets[v.id]?.[0];
                    return (
                        <div key={v.id} onClick={() => topSong && onSelect(v.id)} className={`relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl p-6 transition-all group h-64 flex flex-col justify-between ${topSong ? 'cursor-pointer hover:border-white/20' : 'opacity-50 cursor-not-allowed'}`}>
                            {topSong && <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"><img src={topSong.album.images[0]?.url} className="w-full h-full object-cover blur-xl" alt="" /></div>}
                            <div className="relative z-10 flex justify-between items-start"><div className={`p-3 rounded-xl bg-zinc-950/50 backdrop-blur text-${v.color}-400`}>{v.icon}</div></div>
                            <div className="relative z-10">
                                <h3 className={`text-2xl font-bold mb-1 group-hover:text-${v.color}-400 transition-colors`}>{v.id}</h3>
                                <p className="text-sm text-zinc-400 mb-4">{v.desc}</p>
                                {topSong ? (
                                    <div className="flex items-center gap-3 bg-zinc-950/40 p-2 rounded-lg backdrop-blur border border-white/5">
                                        <img src={topSong.album.images[0]?.url} className="w-10 h-10 rounded" alt="" />
                                        <div className="overflow-hidden"><p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Your Anthem</p><p className="text-sm font-bold truncate">{topSong.name}</p></div>
                                    </div>
                                ) : <div className="text-sm text-zinc-600 italic">No matches found.</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SelectionView = ({ title, candidates, selectedIds, onToggle, onConfirm, onBack }: any) => {
    const isUnderground = title === 'Gatekeeper Score';
    const isTimeline = title === 'Your Eras';

    const getUniquenessColor = (popularity: number) => {
        const uniqueness = 100 - popularity;
        if (uniqueness >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Royal Gem' };
        if (uniqueness >= 50) return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Underground' };
        return { bg: 'bg-lime-200/10', text: 'text-lime-200', label: 'Mainstream' };
    };

    const renderTrackList = (tracks: any[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tracks.map((track: any) => {
                const isSelected = selectedIds.has(track.id);
                const limit = title.includes('Sonic Aura') ? 1 : 10;
                const isDisabled = !isSelected && selectedIds.size >= limit;
                const style = isUnderground ? getUniquenessColor(track.popularity) : null;

                return (
                    <div key={track.id} onClick={() => !isDisabled && onToggle(track.id)} className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-green-900/20 border-green-500' : isDisabled ? 'opacity-40 border-transparent' : 'bg-black/20 border-white/5 hover:bg-black/40'}`}>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-green-500 border-green-500' : 'border-zinc-600'}`}>{isSelected && <Check className="w-4 h-4 text-black" />}</div>
                        <img src={track.album.images[0]?.url} className="w-12 h-12 rounded" alt="" />
                        <div className="overflow-hidden flex-1">
                            <h4 className="font-bold truncate text-sm">{track.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-zinc-400 truncate max-w-[50%]">{track.artists.map((a: any) => a.name).join(', ')}</p>
                                {isUnderground && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style?.bg} ${style?.text}`}>{100 - track.popularity}% ({style?.label})</span>}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
      <div className="animate-in fade-in slide-in-from-right-8 pb-20">
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur z-40 py-4 border-b border-zinc-800 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-zinc-900 rounded-full"><ArrowLeft /></button>
            <div><h2 className="text-xl font-bold">{title}</h2><p className="text-sm text-zinc-400">Select {title.includes('Sonic Aura') ? '1 song' : '10 songs'} ({selectedIds.size}/{title.includes('Sonic Aura') ? '1' : '10'})</p></div>
          </div>
          <button onClick={onConfirm} disabled={selectedIds.size === 0} className="px-6 py-2 bg-[#1DB954] text-black font-bold rounded-full disabled:opacity-30 transition-all">Generate</button>
        </div>
      
        {isUnderground && (
            <div className="mb-8 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-2 mb-3 text-sm text-zinc-400"><BarChart3 className="w-4 h-4" /> <span>Uniqueness Score</span></div>
                <div className="flex gap-2 h-6 rounded-lg overflow-hidden bg-zinc-800">
                    <div className="w-1/3 bg-emerald-600 flex items-center justify-center text-[10px] text-white font-bold">Royal (&gt;80%)</div>
                    <div className="w-1/3 bg-green-500 flex items-center justify-center text-[10px] text-black font-bold">Common (&gt;50%)</div>
                    <div className="w-1/3 bg-lime-200 flex items-center justify-center text-[10px] text-black font-bold">Light (&lt;50%)</div>
                </div>
            </div>
        )}

        {isTimeline ? (
            <div className="space-y-8">
                <div className="p-6 rounded-3xl bg-gradient-to-b from-blue-400/20 to-zinc-900/50 border border-blue-300/20"><h3 className="text-xl font-bold text-blue-200 mb-4">Phase 1: The Foundation</h3>{renderTrackList(candidates.filter((t: any) => t.phase === 1))}</div>
                <div className="p-6 rounded-3xl bg-gradient-to-b from-blue-600/20 to-zinc-900/50 border border-blue-500/20"><h3 className="text-xl font-bold text-blue-400 mb-4">Phase 2: The Evolution</h3>{renderTrackList(candidates.filter((t: any) => t.phase === 2))}</div>
                <div className="p-6 rounded-3xl bg-gradient-to-b from-blue-900/20 to-zinc-900/50 border border-blue-800/20"><h3 className="text-xl font-bold text-blue-600 mb-4">Phase 3: The Now</h3>{renderTrackList(candidates.filter((t: any) => t.phase === 3))}</div>
            </div>
        ) : renderTrackList(candidates)}
      </div>
    );
};

// UPDATED RESULTS VIEW: Implements the "Glass Layout" (Text Left, Card Right) with vintage background
const ResultsView = ({ title, tracks, onBack }: any) => {
    const resultsRef = useRef<HTMLDivElement>(null);
    const isSingleTrack = tracks.length === 1;
    const singleTrack = tracks[0];

    const handleDownload = async () => {
        if (!resultsRef.current) return;
        await new Promise(resolve => setTimeout(resolve, 500));
        const canvas = await html2canvas(resultsRef.current, { backgroundColor: null, scale: 2, useCORS: true });
        const data = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = data;
        link.download = `dammitspotifywrapped.png`;
        link.click();
    };

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black flex flex-col items-center justify-center p-4">
         {/* Vintage Background (Fixed) */}
         <div className="fixed inset-0 vintage-bg z-[-1]"></div>

         <div className="w-full max-w-4xl flex justify-between items-center mb-6 z-10">
             <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white bg-black/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"><ArrowLeft size={18}/> Back</button>
             <button onClick={handleDownload} className="flex items-center gap-2 px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors shadow-lg"><Download size={18} /> Save Poster</button>
         </div>

         {/* === THE GLASS CONTAINER (Text Left, Card Right) === */}
         <div ref={resultsRef} className="poster-glass w-full max-w-[1000px] rounded-[30px] p-8 md:p-14 flex flex-col md:flex-row justify-between items-center gap-10 relative overflow-hidden">
             
             {/* Left Content (Text) */}
             <div className="flex-1 text-center md:text-left z-10">
                 <div className="text-2xl font-bold mb-2 flex items-center justify-center md:justify-start gap-2">
                     <span>🎵</span> dammitspotifywrapped
                 </div>
                 <div className="text-sm md:text-base uppercase tracking-[0.2em] opacity-80 font-semibold mb-8 text-green-300">
                     {isSingleTrack ? `Sonic Aura: ${title}` : title}
                 </div>
                 
                 {/* Branding Footer inside Poster */}
                 <div className="text-[10px] opacity-50 uppercase tracking-widest text-white mt-10">
                     Generated by dammitdc
                 </div>
             </div>

             {/* Right Content (The Glass Card) */}
             <div className="flex-none w-full md:w-[320px] z-10">
                 
                 {isSingleTrack ? (
                     // SINGLE TRACK CARD (Sonic Aura) - Nested Glass
                     <div className="bg-white/10 backdrop-blur-xl border border-white/25 rounded-[20px] p-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                         <img 
                            src={singleTrack.album.images[0]?.url} 
                            alt="Art" 
                            className="w-full aspect-square object-cover rounded-xl mb-5 shadow-lg" 
                            crossOrigin="anonymous" 
                         />
                         <h1 className="text-2xl font-bold text-white mb-1 leading-tight drop-shadow-md">{singleTrack.name}</h1>
                         <p className="text-[#57B685] font-bold uppercase tracking-widest text-sm">{singleTrack.artists[0].name}</p>
                     </div>
                 ) : (
                     // MULTI TRACK LIST (Eras/Gatekeeper) - Adapted to fit the "Card" look
                     <div className="bg-white/10 backdrop-blur-xl border border-white/25 rounded-[20px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] max-h-[450px] overflow-y-auto">
                         <h3 className="text-white font-bold mb-4 border-b border-white/10 pb-2">Top Picks</h3>
                         <div className="space-y-3">
                            {tracks.slice(0, 10).map((t: any, i: number) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-green-400 font-mono text-xs">{i+1}</span>
                                    <img src={t.album.images[0]?.url} className="w-8 h-8 rounded" alt="" crossOrigin="anonymous"/>
                                    <div className="overflow-hidden">
                                        <p className="text-white text-xs font-bold truncate">{t.name}</p>
                                        <p className="text-white/60 text-[10px] truncate">{t.artists[0].name}</p>
                                    </div>
                                </div>
                            ))}
                         </div>
                     </div>
                 )}
             </div>
         </div>
      </div>
    );
};

export default App;
