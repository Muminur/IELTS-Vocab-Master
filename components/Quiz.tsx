import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { StoredWord } from '../types';
import { getDueWords, getFFLWords, updateWordProgress } from '../services/db';

export type QuizMode = 'due' | 'ffl';

interface QuizProps {
  userId: string;
  onClose: () => void;
  onPlayAudio: (text: string) => void;
  onPrefetch: (text: string) => void;
  mode: QuizMode;
}

const Quiz: React.FC<QuizProps> = ({ userId, onClose, onPlayAudio, onPrefetch, mode }) => {
  const [words, setWords] = useState<StoredWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWords();
  }, [userId, mode]);

  const loadWords = async () => {
    setLoading(true);
    setError(null);
    try {
      let fetchedWords: StoredWord[] = [];
      if (mode === 'due') {
          fetchedWords = await getDueWords(userId);
      } else {
          fetchedWords = await getFFLWords(userId);
      }
      
      // Shuffle words
      const shuffled = fetchedWords.sort(() => Math.random() - 0.5);
      setWords(shuffled);

      // Prefetch first few words
      if (shuffled.length > 0) {
        onPrefetch(shuffled[0].word);
        if (shuffled.length > 1) {
            onPrefetch(shuffled[1].word);
        }
      }

    } catch (err: any) {
      console.error("Quiz load error:", err);
      if (err.message && err.message.includes("permissions")) {
        setError("Database Access Denied: Please check if your account is authorized or if Firestore rules are configured correctly.");
      } else {
        setError("Failed to load your words. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResult = async (correct: boolean) => {
    const currentWord = words[currentIndex];
    
    // Optimistic UI update
    if (correct) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#f43f5e', '#fbbf24', '#10b981']
      });
    }

    // Save progress in background
    // Only update SRS stats if in 'due' mode. FFL is just practice.
    if (mode === 'due') {
        updateWordProgress(userId, currentWord.id, correct, currentWord.srsStage);
    }

    // Move next
    if (currentIndex < words.length - 1) {
      setIsFlipped(false);
      
      // Prefetch word after next
      if (currentIndex + 2 < words.length) {
        onPrefetch(words[currentIndex + 2].word);
      }

      setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
    } else {
      setIsComplete(true);
      confetti({
        particleCount: 200,
        spread: 160,
        origin: { y: 0.6 }
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="text-6xl mb-4 text-red-500">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Something Went Wrong</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 px-8">{error}</p>
          <button 
            onClick={onClose}
            className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-2 rounded-full font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      );
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="text-6xl mb-4">
            {mode === 'due' ? '🎉' : '🌟'}
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            {mode === 'due' ? 'All Caught Up!' : 'FFL Empty!'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
            {mode === 'due' 
                ? "You have no words due for review right now." 
                : "You haven't marked any words as forgotten yet."}
        </p>
        <button 
          onClick={onClose}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 animate-fade-in">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            {mode === 'due' ? 'Quiz Complete!' : 'Practice Complete!'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">You've reviewed {words.length} words.</p>
        <button 
          onClick={onClose}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-6">
         <div>
            <span className={`text-xs font-bold uppercase tracking-wider ${mode === 'due' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {mode === 'due' ? 'Daily Review' : 'Hard Words Practice'}
            </span>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
             {currentIndex + 1} of {words.length}
            </h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>

      <div className="relative h-96 w-full perspective-1000 group cursor-pointer" onClick={() => !isFlipped && setIsFlipped(true)}>
        <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className={`absolute w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border-2 flex flex-col items-center justify-center p-8 backface-hidden ${mode === 'due' ? 'border-blue-100 dark:border-blue-900' : 'border-orange-100 dark:border-orange-900'}`}>
            <span className={`text-sm font-bold uppercase tracking-wider mb-4 ${mode === 'due' ? 'text-blue-400' : 'text-orange-400'}`}>Tap to reveal</span>
            <h3 className="text-5xl font-extrabold text-slate-800 dark:text-white capitalize mb-4 text-center">{currentWord.word}</h3>
            <button 
                onClick={(e) => { e.stopPropagation(); onPlayAudio(currentWord.word); }}
                className={`p-3 rounded-full hover:opacity-80 transition-opacity ${mode === 'due' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300'}`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
            </button>
          </div>

          {/* Back */}
          <div className={`absolute w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border-2 flex flex-col p-8 backface-hidden rotate-y-180 ${mode === 'due' ? 'border-blue-100 dark:border-blue-900' : 'border-orange-100 dark:border-orange-900'}`}>
            <div className="flex-1 overflow-y-auto">
                <div className="flex justify-between items-baseline mb-4 flex-wrap">
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white capitalize">{currentWord.word}</h3>
                        {currentWord.ipa && (
                            <span className="text-lg text-slate-400 dark:text-slate-500 font-serif">/{currentWord.ipa}/</span>
                        )}
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400 italic">{currentWord.partOfSpeech}</span>
                </div>
                
                <div className="space-y-4 text-left">
                    <div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Meaning</span>
                        <p className="text-lg text-slate-800 dark:text-slate-100 font-medium">{currentWord.definition}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50">
                        <span className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase">Example</span>
                        <p className="text-amber-900 dark:text-amber-100 italic">"{currentWord.example}"</p>
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-4">
                <button 
                    onClick={(e) => { e.stopPropagation(); handleResult(false); }}
                    className="py-3 px-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                >
                    I Forgot
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleResult(true); }}
                    className="py-3 px-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 font-bold rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                >
                    I Knew It
                </button>
            </div>
          </div>
        </div>
      </div>
      
      <p className="text-center text-slate-400 dark:text-slate-500 text-sm mt-8">
        {isFlipped ? "How did you do?" : "Tap the card to see the meaning"}
      </p>
    </div>
  );
};

export default Quiz;