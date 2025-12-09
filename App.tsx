import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Music, LogIn, ArrowLeft, Zap, Moon, Clock, Smile, Frown, Download, Check, BarChart3, Flame, Loader2, Eye
} from 'lucide-react';

// Assuming these services exist in your project structure
import { 
  redirectToAuthCodeFlow, getAccessToken, fetchTopTracks, fetchAudioFeatures 
} from './services/spotifyService';

import { AppView, SpotifyTrack, VibeMode } from './types';

// ================= STYLES =================
// Injected directly so you can copy-paste into one file
const GLOBAL_STYLES = `
  :root {
    --bg-dark: #0a0a0a;
    --text-light: #ffffff;
    --glass-border: rgba(255, 255, 255, 0.2);
    --glass-bg-low: rgba(255, 255, 255, 0.07);
    --eras-glow: rgba(255, 136, 0, 0.6);
    --gatekeeper-glow: rgba(220, 20, 60, 0.6);
    --sonic-glow: rgba(255, 215, 0, 0.6);
  }

  /* Dashboard Animations */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  /* Custom Scrollbar for lists inside glass */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 10px; }

  /* 3-Card Dashboard Styles */
  .selection-card {
    background-size: cover;
    background-position: center;
    transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.4s ease;
  }
  
  /* Images for the Dashboard Cards - Using placeholders or your assets */
  .card-eras-bg { background-image: url('https://i.ibb.co/hRPQRgR/image-0.png'); background-position: left center; }
  .card-gatekeeper-bg { background-image: url('https://i.ibb.co/hRPQRgR/image-0.png'); background-position: center center; }
  .card-sonic-bg { background-image: url('https://i.ibb.co/hRPQRgR/image-0.png'); background-position: right center; }

  .selection-card:hover { transform: translateY(-15px) scale(1.02); }
  .card-eras-bg:hover { box-shadow: 0 25px 50px -12px var(--eras-glow); }
  .card-gatekeeper-bg:hover { box-shadow: 0 25px 50px -12px var(--gatekeeper-glow); }
  .card-sonic-bg:hover { box-shadow: 0 25px 50px -12px var(--sonic-glow); }

  /* Glass Poster Styles */
  .poster-glass-container {
    background: rgba(0, 0, 0, 0.4);
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
    <div className="min-h-screen text-white font-sans overflow-x-hidden flex flex-col">
      <style>{GLOBAL_STYLES}</style>
      
      {/* Background is handled differently per view now, main wrapper gets deep dark */}
      <div className={`fixed inset-0 z-[-1] ${view === AppView.RESULTS ? '' : 'bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#000000_100%)]'}`}></div>

      <Header logout={logout} />
      
      {loading && <LoadingOverlay />}
      {error && <ErrorBanner message={error} />}

      <main className="flex-grow flex flex-col items-center justify-center p-6 md:p-12 w-full max-w-7xl mx-auto">
        
        {/* === NEW DASHBOARD (3-Card Selection) === */}
        {view === AppView.DASHBOARD && (
          <div className="flex flex-wrap gap-8 justify-center items-center w-full animate-[fadeIn_0.5s_ease]">
             
             {/* Card 1: Eras */}
             <div onClick={handleYourEras} className="selection-card card-eras-bg w-[320px] h-[480px] rounded-3xl relative overflow-hidden cursor-pointer border border-white/20">
                <div className="absolute bottom-0 left-0 width-full w-full p-6 pb-8 bg-gradient-to-b from-transparent via-black/80 to-black/95 backdrop-blur-[2px]">
                   <h2 className="text-3xl font-black uppercase text-white drop-shadow-md mb-2">Your Eras</h2>
                   <p className="text-zinc-300 font-medium">Travel through your musical history.</p>
                </div>
             </div>

             {/* Card 2: Gatekeeper */}
             <div onClick={handleGatekeeper} className="selection-card card-gatekeeper-bg w-[320px] h-[480px] rounded-3xl relative overflow-hidden cursor-pointer border border-white/20">
                <div className="absolute bottom-0 left-0 width-full w-full p-6 pb-8 bg-gradient-to-b from-transparent via-black/80 to-black/95 backdrop-blur-[2px]">
                   <h2 className="text-3xl font-black uppercase text-white drop-shadow-md mb-2">Gatekeeper Score</h2>
                   <p className="text-zinc-300 font-medium">How unique is your music taste?</p>
                </div>
             </div>

             {/* Card 3: Sonic Aura */}
             <div onClick={handleSonicAura} className="selection-card card-sonic-bg w-[320px] h-[480px] rounded-3xl relative overflow-hidden cursor-pointer border border-white/20">
                <div className="absolute bottom-0 left-0 width-full w-full p-6 pb-8 bg-gradient-to-b from-transparent via-black/80 to-black/95 backdrop-blur-[2px]">
                   <h2 className="text-3xl font-black uppercase text-white drop-shadow-md mb-2">Sonic Aura</h2>
                   <p className="text-zinc-300 font-medium">Discover your true musical vibe.</p>
                </div>
             </div>

          </div>
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
      </main>
    </div>
  );
};

// --- SUB COMPONENTS ---

const LoginView = ({ error, loading, onLogin }: any) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-black relative text-white">
    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
        <Music className="w-8 h-8 text-black" />
    </div>
    <h1 className="text-5xl font-black mb-8 tracking-tighter">dammitspotifywrapped</h1>
    <button onClick={onLogin} disabled={loading} className="flex items-center gap-2 bg-green-500 text-black font-bold py-4 px-10 rounded-full hover:scale-105 transition-transform text-lg shadow-lg">
       {loading ? <Loader2 className="animate-spin" /> : <LogIn className="w-5 h-5" />}
       {loading ? "Connecting..." : "Log in with Spotify"}
    </button>
    {error && <p className="text-red-500 mt-4 bg-red-900/20 px-4 py-2 rounded">{error}</p>}
  </div>
);

const Header = ({ logout }: any) => (
  <nav className="w-full flex justify-between items-center px-8 py-6 z-10">
    <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <span className="text-2xl">🎵</span> dammitspotifywrapped
    </div>
    <button onClick={logout} className="text-white/60 hover:text-white transition-colors text-sm font-semibold">Log out</button>
  </nav>
);

const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 flex-col gap-4 backdrop-blur-sm">
        <Loader2 className="animate-spin text-green-500 w-12 h-12"/>
        <p className="text-green-500 animate-pulse font-mono tracking-widest">ANALYZING LIBRARY...</p>
    </div>
);

const ErrorBanner = ({message}: any) => <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-full z-50 shadow-xl">{message}</div>;


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
        <div className="animate-[fadeIn_0.5s_ease] w-full max-w-5xl">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><ArrowLeft /></button>
                <div>
                    <h2 className="text-3xl font-bold">Which Vibe defines you?</h2>
                    <p className="text-zinc-400">Choose one to reveal your anthem.</p>
                </div>
            </div>
             
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vibes.map((v) => (
                    <div key={v.id} onClick={() => onSelectVibe(v.id)} className={`relative bg-zinc-900/40 border border-white/10 hover:border-${v.color}-500 hover:bg-zinc-900/80 rounded-2xl p-6 transition-all cursor-pointer group h-40 flex flex-col justify-between backdrop-blur-sm`}>
                        <div className={`p-3 rounded-xl bg-black/40 w-fit text-${v.color}-400`}>{v.icon}</div>
                        <div>
                            <h3 className={`text-xl font-bold mb-1 group-hover:text-${v.color}-400 transition-colors`}>{v.id}</h3>
                            <p className="text-xs text-zinc-500">{v.desc}</p>
                        </div>
                    </div>
                ))}
                
                <div onClick={onRevealAll} className="bg-gradient-to-br from-green-900/20 to-zinc-900/40 border border-green-500/30 hover:border-green-500 hover:from-green-900/40 rounded-2xl p-6 transition-all cursor-pointer group h-40 flex flex-col justify-center items-center text-center col-span-full md:col-span-1 lg:col-span-3 backdrop-blur-sm">
                        <div className="p-3 rounded-full bg-green-500/10 text-green-400 mb-2 group-hover:scale-110 transition-transform"><Eye className="w-6 h-6"/></div>
                        <h3 className="text-lg font-bold text-white">Reveal All</h3>
                </div>
            </div>
        </div>
    );
};

const VibeMenuView = ({ buckets, onSelect, onBack }: any) => {
    // Reusing logic but simpler UI
    const vibes = Object.keys(buckets);
    return (
        <div className="animate-[fadeIn_0.5s_ease] w-full max-w-5xl">
             <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-3 bg-white/10 hover:bg-white/20 rounded-full"><ArrowLeft /></button>
                <h2 className="text-3xl font-bold">Your Full Sonic Profile</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {vibes.map(v => {
                     const track = buckets[v]?.[0];
                     if(!track) return null;
                     return (
                         <div key={v} onClick={() => onSelect(v)} className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-zinc-800 transition-colors">
                             <img src={track.album.images[0]?.url} className="w-16 h-16 rounded-md" alt="" />
                             <div>
                                 <h4 className="font-bold text-lg">{v}</h4>
                                 <p className="text-sm text-zinc-400 truncate w-40">{track.name}</p>
                             </div>
                         </div>
                     )
                 })}
            </div>
        </div>
    )
}

const SelectionView = ({ title, candidates, selectedIds, onToggle, onConfirm, onBack }: any) => {
    const isUnderground = title === 'Gatekeeper Score';
    const isTimeline = title === 'Your Eras';

    return (
      <div className="animate-[fadeIn_0.5s_ease] w-full max-w-6xl pb-20">
        <div className="sticky top-0 bg-black/80 backdrop-blur-md z-40 py-4 border-b border-white/10 mb-6 flex justify-between items-center rounded-b-2xl px-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><ArrowLeft /></button>
            <div><h2 className="text-xl font-bold">{title}</h2><p className="text-sm text-zinc-400">{selectedIds.size} selected</p></div>
          </div>
          <button onClick={onConfirm} disabled={selectedIds.size === 0} className="px-8 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition-all disabled:opacity-50">Generate Poster</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
             {candidates.map((track: any) => {
                 const isSelected = selectedIds.has(track.id);
                 return (
                     <div key={track.id} onClick={() => onToggle(track.id)} className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-green-900/30 border-green-500' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                         <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-green-500 border-green-500' : 'border-zinc-600'}`}>{isSelected && <Check className="w-4 h-4 text-black" />}</div>
                         <img src={track.album.images[0]?.url} className="w-12 h-12 rounded" alt="" />
                         <div className="overflow-hidden">
                             <h4 className="font-bold truncate text-sm text-white">{track.name}</h4>
                             <p className="text-xs text-zinc-400 truncate">{track.artists[0].name}</p>
                         </div>
                     </div>
                 );
             })}
        </div>
      </div>
    );
};

// ================= THE NEW POSTER COMPONENT =================
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
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black">
        {/* VINTAGE BACKGROUND FOR POSTER SCREEN */}
        <div className="fixed inset-0 bg-[url('https://i.ibb.co/f2FygQj/image-1.png')] bg-cover bg-center opacity-100 z-[-1]"></div>

        <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
             
             <div className="w-full max-w-4xl flex justify-between items-center mb-6 z-10">
                 <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white bg-black/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"><ArrowLeft size={18}/> Back</button>
                 <button onClick={handleDownload} className="flex items-center gap-2 px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors shadow-lg"><Download size={18} /> Save Poster</button>
             </div>

             {/* === THE GLASS CONTAINER (Text Left, Card Right) === */}
             <div ref={resultsRef} className="poster-glass-container w-full max-w-[1000px] rounded-[30px] p-8 md:p-14 flex flex-col md:flex-row justify-between items-center gap-10 relative overflow-hidden">
                 
                 {/* Left Content (Text) */}
                 <div className="flex-1 text-center md:text-left z-10">
                     <div className="text-2xl font-bold mb-2 flex items-center justify-center md:justify-start gap-2">
                         <span>🎵</span> dammitspotifywrapped
                     </div>
                     <div className="text-sm md:text-base uppercase tracking-[0.2em] opacity-80 font-semibold mb-8 text-green-300">
                         {isSingleTrack ? `Sonic Aura: ${title}` : title}
                     </div>
                     
                     {/* If it's a list (Eras), show a summary or specific text here */}
                     {!isSingleTrack && (
                        <div className="text-zinc-200 text-sm mb-4">
                           Displaying your top selection.
                        </div>
                     )}
                 </div>

                 {/* Right Content (The Glass Card) */}
                 <div className="flex-none w-full md:w-[320px] z-10">
                     
                     {isSingleTrack ? (
                         // SINGLE TRACK CARD (Sonic Aura)
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
                                {tracks.slice(0, 8).map((t: any, i: number) => (
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

                 {/* Branding Footer inside Poster */}
                 <div className="absolute bottom-4 right-8 text-[10px] opacity-50 uppercase tracking-widest text-white">
                     Generated by dammitdc
                 </div>
             </div>

        </div>
      </div>
    );
};

export default App;
