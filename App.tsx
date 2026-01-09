import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  onAuthStateChanged, 
  User, 
  signOut,
  isSignInWithEmailLink,
  signInWithEmailLink 
} from 'firebase/auth';
import { auth } from './firebase';
import { fetchWordAnalysis, fetchTtsAudio } from './services/geminiService';
import { saveWordToProfile, verifyDbConnection } from './services/db';
import { decodeAudioData, playAudioBuffer } from './utils/audioUtils';
import { WordDetails } from './types';
import WordCard from './components/WordCard';
import MindMap from './components/MindMap';
import Login from './components/Login';
import Quiz from './components/Quiz';
import Exam from './components/Exam';

enum Tab {
  SEARCH = 'SEARCH',
  QUIZ = 'QUIZ',
  EXAM = 'EXAM',
  FFL = 'FFL'
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.SEARCH);
  
  // Theme State (Default to Dark)
  const [darkMode, setDarkMode] = useState(true);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<WordDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  
  // Audio State
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // DB Verification State
  const [verifying, setVerifying] = useState(false);

  // Apply dark mode class to html element or wrapper
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen to Auth State and handle Magic Link
  useEffect(() => {
    // Check for magic link redirect
    const handleMagicLink = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
          // If email is not available in storage, prompt the user.
          email = window.prompt('Please provide your email for confirmation');
        }
        
        if (email) {
          try {
            await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            // Clean URL but preserve pathname
            window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}`);
          } catch (err) {
            console.error('Error signing in with email link', err);
            alert("Failed to sign in with this link. It may have expired.");
          }
        }
      }
    };
    
    handleMagicLink();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Initialize AudioContext on first interaction
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 }); // Gemini TTS sample rate
    }
    if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const prefetchAudio = async (text: string) => {
    if (!text) return;
    // Normalize text to prevent cache misses on case/punctuation
    const cacheKey = text.trim().toLowerCase();

    // If already cached, skip
    if (audioCache.current.has(cacheKey)) return;

    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const base64Audio = await fetchTtsAudio(text);
        const buffer = await decodeAudioData(base64Audio, ctx);
        
        audioCache.current.set(cacheKey, buffer);
    } catch (err) {
        // Silent fail for prefetch - normal if rate limited or word issue
        // We don't want to spam console
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    // Initialize audio context on user gesture (search submit)
    getAudioContext();

    setLoading(true);
    setError(null);
    setData(null);
    setIsSaved(false);

    try {
      const result = await fetchWordAnalysis(searchTerm);
      setData(result);
      
      // Auto-save logic
      if (user && result) {
        try {
          await saveWordToProfile(user.uid, result);
          setIsSaved(true);
        } catch (saveErr: any) {
          if (saveErr.message && saveErr.message.includes("already saved")) {
            setIsSaved(true);
          } else {
            console.warn("Auto-save failed:", saveErr);
          }
        }
      }

      // --- Aggressive Background Prefetching ---
      // We throttle these slightly to avoid hitting rate limits instantly
      const toPrefetch = [
          result.word,
          ...result.synonyms.slice(0, 3),
          ...result.antonyms.slice(0, 3),
          ...result.collocations.slice(0, 2)
      ];

      // Sequential firing to be nicer to the API, but non-blocking for UI
      (async () => {
          for (const word of toPrefetch) {
              await prefetchAudio(word);
              // Larger delay between requests to avoid rate limits (200ms -> 1500ms)
              await new Promise(r => setTimeout(r, 1500));
          }
      })();

    } catch (err) {
      console.error(err);
      setError("Could not find definition. Please check your API key or try another word.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWord = async () => {
    if (!user || !data) return;
    try {
        await saveWordToProfile(user.uid, data);
        setIsSaved(true);
    } catch (err: any) {
        if (err.message && err.message.includes("already saved")) {
            setIsSaved(true);
        } else {
            alert(err.message || "Failed to save word");
        }
    }
  };

  const handleVerifyConnection = async () => {
      if (!user) return;
      setVerifying(true);
      try {
          const result = await verifyDbConnection(user.uid);
          alert(result.message);
      } catch (e) {
          alert("Unknown error occurred during verification.");
      } finally {
          setVerifying(false);
      }
  };

  const stopCurrentAudio = () => {
    if (activeSourceRef.current) {
        try {
            activeSourceRef.current.stop();
        } catch (e) {
            // Ignore if already stopped
        }
        activeSourceRef.current = null;
    }
    setPlayingWord(null);
  };

  const playText = async (text: string) => {
    if (!text) return;
    
    // 1. Stop any currently playing audio immediately (Interrupt mode)
    stopCurrentAudio();

    const cacheKey = text.trim().toLowerCase();
    setPlayingWord(text);

    try {
      const ctx = getAudioContext();
      if (!ctx) {
        setPlayingWord(null);
        return;
      }

      // Check cache first
      let buffer = audioCache.current.get(cacheKey);

      if (!buffer) {
        const base64Audio = await fetchTtsAudio(text);
        buffer = await decodeAudioData(base64Audio, ctx);
        audioCache.current.set(cacheKey, buffer);
      }
      
      // If user clicked something else while we were fetching/decoding, abort play
      if (playingWord !== null && playingWord !== text) {
          return; 
      }

      const source = playAudioBuffer(buffer, ctx);
      activeSourceRef.current = source;
      
      source.onended = () => {
        // Only clear playingWord if this source was the one playing
        if (activeSourceRef.current === source) {
            setPlayingWord(null);
            activeSourceRef.current = null;
        }
      };
    } catch (err: any) {
      console.error("TTS Error:", err);
      // alert(`Could not play audio: ${err.message}`); // Optional: Un-comment if users need to see the error
      setPlayingWord(null);
    }
  };

  // Right-click context menu handler
  useEffect(() => {
    const handleContextMenu = async (e: MouseEvent) => {
      // If the event was already handled (e.g. by MindMap component), don't duplicate
      if (e.defaultPrevented) return;

      // Check if user right-clicked a text element inside our app
      const target = e.target as HTMLElement;
      
      // Get selected text or clicked text
      let textToPlay = '';
      const selection = window.getSelection()?.toString();

      if (selection && selection.length > 0) {
        textToPlay = selection;
      } else if (target.innerText && target.innerText.length < 50) {
        // Fallback: simple text elements (like list items, titles)
        textToPlay = target.innerText;
      } else if (target.textContent && target.textContent.length < 50) {
         // Fallback for SVG text or other elements where innerText is undefined
         textToPlay = target.textContent;
      }

      if (textToPlay) {
        e.preventDefault(); // Prevent default browser menu
        await playText(textToPlay);
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [playingWord]); // Re-bind if audio state changes

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400">Loading...</div>;
  }

  if (!user) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
            <Login />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-300">
      {/* Navbar */}
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentTab(Tab.SEARCH)}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
                I
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-rose-500 hidden sm:block">
                IELTS Vocab Master
              </span>
            </div>
            
            <div className="flex items-center gap-2 lg:gap-4 overflow-x-auto">
               <button 
                onClick={() => setCurrentTab(Tab.SEARCH)}
                className={`px-3 lg:px-4 py-2 rounded-full font-medium transition-colors text-sm whitespace-nowrap ${currentTab === Tab.SEARCH ? 'bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
               >
                 Dictionary
               </button>
               <button 
                onClick={() => setCurrentTab(Tab.QUIZ)}
                className={`px-3 lg:px-4 py-2 rounded-full font-medium transition-colors text-sm whitespace-nowrap flex items-center gap-2 ${currentTab === Tab.QUIZ ? 'bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
               >
                 <span>Daily Quiz</span>
               </button>
               <button 
                onClick={() => setCurrentTab(Tab.EXAM)}
                className={`px-3 lg:px-4 py-2 rounded-full font-medium transition-colors text-sm whitespace-nowrap ${currentTab === Tab.EXAM ? 'bg-purple-50 dark:bg-slate-700 text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400'}`}
               >
                 Exam
               </button>
               <button 
                onClick={() => setCurrentTab(Tab.FFL)}
                className={`px-3 lg:px-4 py-2 rounded-full font-medium transition-colors text-sm whitespace-nowrap flex items-center gap-1 ${currentTab === Tab.FFL ? 'bg-orange-50 dark:bg-slate-700 text-orange-600 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400'}`}
               >
                 <span>FFL</span>
                 <span className="text-[10px] bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded text-orange-600 dark:text-orange-300 font-bold border border-orange-200 dark:border-orange-800">Hard</span>
               </button>

               <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
               
               {/* Theme Toggle */}
               <button 
                 onClick={() => setDarkMode(!darkMode)}
                 className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                 title="Toggle Dark Mode"
               >
                 {darkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                 ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                 )}
               </button>

               <div className="flex items-center gap-3">
                    <button
                        onClick={handleVerifyConnection}
                        disabled={verifying}
                        className="text-xs font-medium text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded border border-transparent hover:border-blue-100 dark:hover:border-blue-900 transition-colors hidden md:block"
                        title="Test Database Connection"
                    >
                        {verifying ? 'Testing...' : 'Test Conn'}
                    </button>
                    <img src={user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} alt="User" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600 bg-white" />
                    <button 
                        onClick={() => signOut(auth)}
                        className="text-sm text-slate-500 hover:text-red-500 font-medium whitespace-nowrap"
                    >
                        Sign Out
                    </button>
               </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        
        {currentTab === Tab.QUIZ && (
            <Quiz 
              userId={user.uid} 
              onClose={() => setCurrentTab(Tab.SEARCH)} 
              onPlayAudio={playText} 
              onPrefetch={prefetchAudio}
              mode="due" 
            />
        )}

        {currentTab === Tab.FFL && (
            <Quiz 
              userId={user.uid} 
              onClose={() => setCurrentTab(Tab.SEARCH)} 
              onPlayAudio={playText} 
              onPrefetch={prefetchAudio}
              mode="ffl" 
            />
        )}

        {currentTab === Tab.EXAM && (
            <Exam 
              userId={user.uid} 
              onClose={() => setCurrentTab(Tab.SEARCH)} 
              onPlayAudio={playText} 
              onPrefetch={prefetchAudio}
              onGoToFFL={() => setCurrentTab(Tab.FFL)} 
            />
        )}
        
        {currentTab === Tab.SEARCH && (
            <>
                {/* Search Header */}
                <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
                    Expand Your Vocabulary
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
                    Get comprehensive definitions, visual mind maps, and perfect US pronunciation for your IELTS preparation.
                </p>

                <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
                    <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Enter a word (e.g., Indispensable)"
                        className="w-full pl-12 pr-4 py-4 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-lg shadow-sm transition-all"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-full font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Analyzing...' : 'Search'}
                    </button>
                    </div>
                </form>
                </div>

                {/* Error Message */}
                {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-8 rounded-r-lg">
                    <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                    </div>
                </div>
                )}

                {/* Content Area */}
                {data && (
                <div className="space-y-10 animate-fade-in">
                    <WordCard 
                        data={data} 
                        onPlayWord={playText}
                        playingWord={playingWord}
                        onSave={handleSaveWord}
                        isSaved={isSaved}
                    />
                    
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Visual Mind Map</h2>
                            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
                        </div>
                        <MindMap data={data} onPlayAudio={playText} />
                    </div>
                </div>
                )}
                
                {!data && !loading && !error && (
                    <div className="mt-20 text-center opacity-40">
                        <svg className="w-24 h-24 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <p className="dark:text-slate-400">Search a word to start building your dictionary.</p>
                    </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};

export default App;