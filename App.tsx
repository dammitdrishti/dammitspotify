import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  LogIn, ArrowLeft, Zap, Moon, Clock, Smile, Frown, Download, Check, BarChart3, Flame, Loader2, Eye, PlayCircle
} from 'lucide-react';

// Assuming these services exist in your project structure
import { 
  redirectToAuthCodeFlow, getAccessToken, fetchTopTracks, fetchAudioFeatures 
} from './services/spotifyService';

import { AppView, SpotifyTrack, VibeMode } from './types';

// ================= STYLES =================
const GLOBAL_STYLES = `
  /* Custom Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 10px; }

  /* Vintage Background (Only for Sonic Aura Single View) */
  .vintage-bg {
    background-image: url('https://i.ibb.co/f2FygQj/image-1.png');
    background-size: cover;
    background-position: center;
  }

  /* Sonic Aura Specific Glass (Morphed Box) */
  .sonic-glass {
    background: rgba(255, 255, 255, 0.05); 
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  /* Dashboard Cards - Clean Lift, No Scale Jitter */
  .spotlight-card {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .spotlight-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px -5px rgba(0,0,0,0.6); 
  }
  
  /* Song Card Hover for Play Button */
  .song-card .play-overlay { opacity: 0; transition: opacity 0.2s ease; }
  .song-card:hover .play-overlay { opacity: 1; }
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

  // --- Auth & Init ---
  useEffect(() => {
    document.title = "dammitspotify"; 
    
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

  const startSelection = (tracks: SpotifyTrack[], title: string) => {
    // STRICT FORCE: Only take the first 25 items passed to this function
    const limit = 25; 
    setCandidates(tracks.slice(0, limit));
    setSelectedIds(new Set()); 
    setResultTitle(title);
    setView(AppView.SELECTION); 
  };

  // --- Feature Handlers ---
  const handleYourEras = async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      // 1. Fetch top 50
      const tracks = await fetchTopTracks(token, 50, 'long_term');
      
      // 2. CRITICAL FIX: Slice to Top 25 MOST PLAYED *BEFORE* sorting by date
      const top25 = tracks.slice(0, 25);

      // 3. Sort those 25 by Release Date
      const sorted = top25.sort((a: any, b: any) => a.album.release_date.localeCompare(b.album.release_date));
      
      // 4. Assign Phases
      const phasedTracks = sorted.map((t: any, index: number) => ({
          ...t,
          phase: index < sorted.length / 3 ? 1 : index < (2 * sorted.length) / 3 ? 2 : 3
      }));

      startSelection(phasedTracks, 'Your Eras');
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const handleGatekeeper = async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const allTracks = await fetchTopTracks(token, 50, 'long_term');
      // Sort by popularity (Ascending)
      const sorted = allTracks.sort((a, b) => a.popularity - b.popularity);
      // Slice the 25 most obscure
      const candidates = sorted.slice(0, 25);
      startSelection(candidates, 'Gatekeeper Score');
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

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
        if (sortFn === null) winner = availableTracks[0];
        else {
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

  const openSpotify = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank');
  };

  if (view === AppView.LOGIN) return <LoginView error={error} loading={loading} onLogin={handleLogin} />;
    
  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-12 text-white font-sans relative overflow-x-hidden">
      <style>{GLOBAL_STYLES}</style>
      
      {/* Background for non-result views - Clean Radial */}
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
                openSpotify={openSpotify}
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
            openSpotify={openSpotify}
            />
        )}

        {view === AppView.RESULTS && (
            <ResultsView 
            title={resultTitle}
            tracks={finalTracks}
            onBack={() => setView(AppView.DASHBOARD)}
            openSpotify={openSpotify}
            />
        )}
      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const LoginView = ({ error, loading, onLogin }: any) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 relative">
    <div className="w-24 h-24 mb-6 rounded-full overflow-hidden shadow-2xl">
        <img src="logo.png" alt="Logo" className="w-full h-full object-cover" />
    </div>
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
    <div className="flex items-center gap-3">
        <img src="logo.png" alt="Logo" className="w-12 h-12 rounded-full border border-white/10" />
        <b className="tracking-tight text-2xl font-black">dammitspotifywrapped</b>
    </div>
    <button onClick={logout} className="text-zinc-400 hover:text-white transition-colors">Log out</button>
  </header>
);

const LoadingOverlay = () => <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 flex-col gap-4"><Loader2 className="animate-spin text-green-500 w-12 h-12"/><p className="text-green-500 animate-pulse">Analyzing Library...</p></div>;
const ErrorBanner = ({message}: any) => <div className="bg-red-900/50 text-red-200 p-4 rounded mb-6 text-center">{message}</div>;

// UPDATED DASHBOARD: Clean Lift (No Scale)
const Dashboard = ({ onYourEras, onGatekeeper, onSonicAura }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
    <ImageCard onClick={onYourEras} imageSrc="/spot1.jpg" title="Your Eras" description="Travel through your musical history." />
    <ImageCard onClick={onGatekeeper} imageSrc="/spot2.jpg" title="Gatekeeper Score" description="How unique is your music taste?" />
    <ImageCard onClick={onSonicAura} imageSrc="/spot3.jpg" title="Sonic Aura" description="Discover your true musical vibe." />
  </div>
);

const ImageCard = ({ onClick, imageSrc, title, description }: any) => (
  <div onClick={onClick} className={`spotlight-card relative h-[480px] rounded-[2rem] overflow-hidden cursor-pointer bg-zinc-900 border border-white/10`}>
    <img src={imageSrc} alt={title} className="w-full h-full object-cover" />
    <div className="absolute bottom-0 left-0 width-full w-full p-6 pb-8 bg-gradient-to-b from-transparent via-black/80 to-black/95 backdrop-blur-[2px]">
      <h3 className="text-3xl font-black text-white mb-2 tracking-wide uppercase drop-shadow-md">{title}</h3>
      <p className="text-zinc-200 text-sm font-medium opacity-90">{description}</p>
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
                <button onClick={onBack} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800"><ArrowLeft /></button>
                <div>
                    <h2 className="text-3xl font-bold">Which Vibe defines you?</h2>
                    <p className="text-zinc-400">Choose one to reveal your anthem.</p>
                </div>
            </div>
             
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vibes.map((v) => (
                    <div key={v.id} onClick={() => onSelectVibe(v.id)} className={`spotlight-card relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 cursor-pointer group h-48 flex flex-col justify-between`}>
                        <div className={`p-3 rounded-xl bg-zinc-950/50 w-fit text-${v.color}-400`}>{v.icon}</div>
                        <div>
                            <h3 className={`text-xl font-bold mb-1 text-white`}>{v.id}</h3>
                            <p className="text-sm text-zinc-400">{v.desc}</p>
                        </div>
                    </div>
                ))}
                
                <div onClick={onRevealAll} className="spotlight-card relative bg-gradient-to-br from-green-900/20 to-zinc-900/50 border border-green-500/20 rounded-2xl p-6 cursor-pointer h-48 flex flex-col justify-center items-center text-center col-span-full md:col-span-1 lg:col-span-3">
                        <div className="p-4 rounded-full bg-green-500/10 text-green-400 mb-4"><Eye className="w-8 h-8"/></div>
                        <h3 className="text-2xl font-bold mb-2 text-white">Reveal All Vibes</h3>
                </div>
            </div>
        </div>
    );
};

const VibeMenuView = ({ buckets, onSelect, onBack, openSpotify }: any) => {
    const resultsRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!resultsRef.current) return;
        await new Promise(resolve => setTimeout(resolve, 500));
        const canvas = await html2canvas(resultsRef.current, { backgroundColor: '#09090b', scale: 2, useCORS: true });
        const data = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = data;
        link.download = `dammitspotifywrapped-full-profile.png`;
        link.click();
    };

    const vibes = Object.keys(buckets);
    return (
        <div className="animate-in fade-in">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800"><ArrowLeft /></button>
                    <h2 className="text-3xl font-bold">Your Full Sonic Profile</h2>
                </div>
                <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 transition-colors">
                    <Download className="w-4 h-4" /> Save Poster
                </button>
            </div>
            
            <div ref={resultsRef} className="p-8 bg-zinc-950 rounded-3xl border border-zinc-900">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vibes.map(v => {
                        const track = buckets[v]?.[0];
                        if(!track) return null;
                        return (
                            <div key={v} onClick={() => onSelect(v)} className="song-card bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-zinc-800 transition-colors relative group">
                                <div className="relative w-16 h-16 shrink-0">
                                    <img src={track.album.images[0]?.url} className="w-full h-full rounded-md shadow-lg" alt="" crossOrigin="anonymous"/>
                                    {/* Play Overlay */}
                                    <div className="play-overlay absolute inset-0 bg-black/50 flex items-center justify-center rounded-md" onClick={(e) => openSpotify(e, track.external_urls.spotify)}>
                                        <PlayCircle className="text-white w-8 h-8" />
                                    </div>
                                </div>
                                <div className="overflow-hidden">
                                    <h4 className="font-bold text-lg text-white">{v}</h4>
                                    <p className="text-sm text-zinc-400 truncate">{track.name}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="mt-8 text-center text-xs text-zinc-600 uppercase tracking-widest">Generated by dammitdc</div>
            </div>
        </div>
    )
}

const SelectionView = ({ title, candidates, selectedIds, onToggle, onConfirm, onBack, openSpotify }: any) => {
    const isUnderground = title === 'Gatekeeper Score';
    const isTimeline = title === 'Your Eras';

    return (
      <div className="animate-in fade-in slide-in-from-right-8 pb-20">
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur z-40 py-4 border-b border-zinc-800 mb-6 flex justify-between items-center px-2">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800"><ArrowLeft /></button>
            <div><h2 className="text-xl font-bold">{title}</h2><p className="text-sm text-zinc-400">Select {title.includes('Sonic Aura') ? '1 song' : '10 songs'} ({selectedIds.size}/{title.includes('Sonic Aura') ? '1' : '10'})</p></div>
          </div>
          <button onClick={onConfirm} disabled={selectedIds.size === 0} className="px-6 py-2 bg-[#1DB954] text-black font-bold rounded-full disabled:opacity-30 transition-all">Generate</button>
        </div>
      
        {isTimeline && (
             <div className="mb-8 p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Your Music Timeline</h3>
                <div className="flex h-8 rounded-lg overflow-hidden w-full">
                    <div className="flex-1 bg-gradient-to-r from-blue-900 to-blue-600 flex items-center justify-center text-[10px] md:text-xs font-bold text-white/90">JAN - APR</div>
                    <div className="flex-1 bg-gradient-to-r from-purple-900 to-purple-600 flex items-center justify-center text-[10px] md:text-xs font-bold text-white/90">MAY - AUG</div>
                    <div className="flex-1 bg-gradient-to-r from-pink-900 to-pink-600 flex items-center justify-center text-[10px] md:text-xs font-bold text-white/90">SEP - DEC</div>
                </div>
            </div>
        )}

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {candidates.map((track: any) => {
                const isSelected = selectedIds.has(track.id);
                const limit = title.includes('Sonic Aura') ? 1 : 10;
                const isDisabled = !isSelected && selectedIds.size >= limit;
                let phaseClass = "";
                if (isTimeline) {
                     if (track.phase === 1) phaseClass = "border-l-4 border-l-blue-500";
                     if (track.phase === 2) phaseClass = "border-l-4 border-l-purple-500";
                     if (track.phase === 3) phaseClass = "border-l-4 border-l-pink-500";
                }

                return (
                    <div key={track.id} onClick={() => !isDisabled && onToggle(track.id)} className={`song-card flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${phaseClass} ${isSelected ? 'bg-green-900/20 border-green-500' : isDisabled ? 'opacity-40 border-transparent' : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900'}`}>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-green-500 border-green-500' : 'border-zinc-600'}`}>{isSelected && <Check className="w-4 h-4 text-black" />}</div>
                        
                        <div className="relative w-12 h-12 shrink-0">
                             <img src={track.album.images[0]?.url} className="w-full h-full rounded" alt="" />
                             <div className="play-overlay absolute inset-0 bg-black/50 flex items-center justify-center rounded" onClick={(e) => openSpotify(e, track.external_urls.spotify)}>
                                <PlayCircle className="text-white w-6 h-6" />
                             </div>
                        </div>

                        <div className="overflow-hidden flex-1">
                            <h4 className="font-bold truncate text-sm text-white">{track.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-zinc-400 truncate max-w-[50%]">{track.artists.map((a: any) => a.name).join(', ')}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    );
};

// UPDATED RESULTS VIEW: 
// 1. Single Track = Morphed Glass Box (with BG Image)
// 2. Multi Track = CLEAN, FLAT, NO GLASS. 
const ResultsView = ({ title, tracks, onBack, openSpotify }: any) => {
    const resultsRef = useRef<HTMLDivElement>(null);
    const isSingleTrack = tracks.length === 1;
    const singleTrack = tracks[0];

    const handleDownload = async () => {
        if (!resultsRef.current) return;
        await new Promise(resolve => setTimeout(resolve, 500));
        // For Sonic Aura (Single), we want to capture the whole vintage BG, so we use null background.
        // For Grid (Multi), we want the clean black, so we use #09090b.
        const exportBg = isSingleTrack ? null : '#09090b';
        
        const canvas = await html2canvas(resultsRef.current, { backgroundColor: exportBg, scale: 2, useCORS: true });
        const data = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = data;
        link.download = `dammitspotifywrapped.png`;
        link.click();
    };

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black flex flex-col items-center justify-center p-4">
         
         {/* Vintage Background - ONLY VISIBLE IF SINGLE TRACK (Sonic Aura) */}
         {isSingleTrack && <div className="fixed inset-0 vintage-bg z-[-1]"></div>}

         <div className="w-full max-w-4xl flex justify-between items-center mb-6 z-10">
             <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white bg-black/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"><ArrowLeft size={18}/> Back</button>
             <button onClick={handleDownload} className="flex items-center gap-2 px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors shadow-lg"><Download size={18} /> Save Poster</button>
         </div>

         {/* === CONDITIONAL LAYOUTS === */}
         
         {isSingleTrack ? (
             // === SINGLE TRACK (Sonic Aura) - Morphed Glass Box ===
             <div ref={resultsRef} className="sonic-glass w-full max-w-[1000px] rounded-[30px] p-8 md:p-14 flex flex-col md:flex-row justify-between items-center gap-10 relative overflow-hidden bg-zinc-950">
                 <div className="flex-1 text-center md:text-left z-10">
                     <div className="text-2xl font-bold mb-2 flex items-center justify-center md:justify-start gap-2"><span>🎵</span> dammitspotifywrapped</div>
                     <div className="text-sm md:text-base uppercase tracking-[0.2em] opacity-80 font-semibold mb-8 text-green-300">Sonic Aura: {title}</div>
                     <div className="text-[10px] opacity-50 uppercase tracking-widest text-white mt-10">Generated by dammitdc</div>
                 </div>
                 <div className="flex-none w-full md:w-[320px] z-10">
                     <div className="bg-white/10 backdrop-blur-xl border border-white/25 rounded-[20px] p-6 text-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] song-card relative group">
                         <div className="relative mb-5">
                             <img src={singleTrack.album.images[0]?.url} alt="Art" className="w-full aspect-square object-cover rounded-xl shadow-lg" crossOrigin="anonymous" />
                             <div className="play-overlay absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl cursor-pointer" onClick={(e) => openSpotify(e, singleTrack.external_urls.spotify)}>
                                 <PlayCircle className="w-16 h-16 text-white opacity-80" />
                             </div>
                         </div>
                         <h1 className="text-2xl font-bold text-white mb-1 leading-tight drop-shadow-md">{singleTrack.name}</h1>
                         <p className="text-[#57B685] font-bold uppercase tracking-widest text-sm">{singleTrack.artists[0].name}</p>
                     </div>
                 </div>
             </div>
         ) : (
             // === MULTI TRACK (Eras/Gatekeeper) - REFINED CLEAN CARD LAYOUT ===
             // No glass. Solid, clean dark background. Watermark style branding.
             <div ref={resultsRef} className="w-full max-w-[1100px] rounded-[30px] p-8 md:p-12 relative overflow-hidden flex flex-col items-center bg-[#0d0d0d] border border-zinc-900 shadow-2xl">
                 
                 {/* Top-Left Watermark Branding */}
                 <div className="absolute top-8 left-8 flex items-center gap-2 opacity-50">
                     <span className="text-xl">🎵</span>
                     <span className="font-bold text-sm tracking-tighter text-white">dammitspotifywrapped</span>
                 </div>

                 <div className="text-center z-10 mb-10 mt-6">
                     {/* Big Green Title */}
                     <div className="text-4xl md:text-5xl font-black mb-3 text-[#1DB954] uppercase tracking-tighter drop-shadow-sm">{title}</div>
                     {/* Subtitle */}
                     <div className="text-xs uppercase tracking-[0.4em] font-bold text-zinc-400">spotify wrapped ka better half</div>
                 </div>

                 {/* 2x5 GRID - Clean Look */}
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-6 w-full z-10 px-4">
                     {tracks.slice(0, 10).map((t: any, i: number) => (
                         <div key={i} className="song-card bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-xl flex flex-col items-center text-center hover:bg-zinc-800 transition-colors group relative shadow-lg">
                             <div className="relative w-full aspect-square mb-4">
                                 <img src={t.album.images[0]?.url} className="w-full h-full rounded-lg shadow-md object-cover" alt="" crossOrigin="anonymous"/>
                                 <div className="play-overlay absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg cursor-pointer transition-opacity" onClick={(e) => openSpotify(e, t.external_urls.spotify)}>
                                    <PlayCircle className="w-12 h-12 text-white opacity-90" />
                                 </div>
                             </div>
                             <div className="w-full">
                                 <p className="font-bold text-white text-sm truncate w-full mb-1">{i+1}. {t.name}</p>
                                 <p className="text-zinc-500 text-xs truncate w-full font-medium">{t.artists[0].name}</p>
                             </div>
                         </div>
                     ))}
                 </div>

                 {/* Visible Footer */}
                 <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-12 z-10 font-bold opacity-70">
                     GENERATED BY DAMMITDC
                 </div>
             </div>
         )}

      </div>
    );
};

export default App;
