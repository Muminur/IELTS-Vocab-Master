import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { StoredWord } from '../types';
import { getUserWords, markWordAsForgot } from '../services/db';

interface ExamProps {
  userId: string;
  onClose: () => void;
  onPlayAudio: (text: string) => void;
  onPrefetch: (text: string) => void;
  onGoToFFL: () => void;
}

const Exam: React.FC<ExamProps> = ({ userId, onClose, onPlayAudio, onPrefetch, onGoToFFL }) => {
  const [words, setWords] = useState<StoredWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotCount, setForgotCount] = useState(0);

  useEffect(() => {
    loadAllWords();
  }, [userId]);

  const loadAllWords = async () => {
    setLoading(true);
    setError(null);
    try {
      const allWords = await getUserWords(userId);
      // Shuffle words for random order exam
      const shuffled = allWords.sort(() => Math.random() - 0.5);
      setWords(shuffled);
      
      // Prefetch the first word if available
      if (shuffled.length > 0) {
        onPrefetch(shuffled[0].word);
        // Also prefetch second word if exists
        if (shuffled.length > 1) {
            onPrefetch(shuffled[1].word);
        }
      }
    } catch (err: any) {
      console.error("Exam load error:", err);
      setError("Failed to load your vocabulary list.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async (forgot: boolean) => {
    const currentWord = words[currentIndex];

    if (forgot) {
      setForgotCount(prev => prev + 1);
      // Mark as forgotten in background
      markWordAsForgot(userId, currentWord.id);
    } else {
        // Optional: Confetti for remembering
        if (Math.random() > 0.7) {
             confetti({
                particleCount: 50,
                spread: 50,
                origin: { y: 0.6 },
                colors: ['#2563eb', '#60a5fa']
            });
        }
    }

    if (currentIndex < words.length - 1) {
      setIsFlipped(false);
      
      // Prefetch the word after next
      if (currentIndex + 2 < words.length) {
        onPrefetch(words[currentIndex + 2].word);
      }

      setTimeout(() => setCurrentIndex(prev => prev + 1), 200);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="text-6xl mb-4">📚</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">No Words Saved Yet</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Search and save words to the dictionary to start an exam.</p>
        <button 
          onClick={onClose}
          className="bg-purple-600 text-white px-6 py-2 rounded-full font-medium hover:bg-purple-700"
        >
          Go to Dictionary
        </button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 animate-fade-in">
        <div className="text-6xl mb-4">🏁</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Exam Complete!</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-2">You reviewed {words.length} words.</p>
        {forgotCount > 0 ? (
            <div className="mb-6">
                <p className="text-orange-600 dark:text-orange-400 font-medium mb-4">
                    You marked {forgotCount} words as forgotten. They have been added to your Frequently Forgot List (FFL).
                </p>
                <div className="flex gap-4 justify-center">
                    <button 
                        onClick={onClose}
                        className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-2 rounded-full font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        Back to Dashboard
                    </button>
                    <button 
                        onClick={onGoToFFL}
                        className="bg-orange-500 text-white px-6 py-2 rounded-full font-medium hover:bg-orange-600 shadow-md shadow-orange-500/30"
                    >
                        Practice FFL Now
                    </button>
                </div>
            </div>
        ) : (
            <div className="mb-6">
                <p className="text-green-600 dark:text-green-400 font-medium mb-4">Perfect! You remembered everything.</p>
                <button 
                    onClick={onClose}
                    className="bg-purple-600 text-white px-6 py-2 rounded-full font-medium hover:bg-purple-700"
                >
                    Back to Dashboard
                </button>
            </div>
        )}
      </div>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Full Exam</span>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
             Word {currentIndex + 1} of {words.length}
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
          <div className="absolute w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border-2 border-purple-100 dark:border-purple-900 flex flex-col items-center justify-center p-8 backface-hidden">
            <span className="text-sm text-purple-400 dark:text-purple-300 font-bold uppercase tracking-wider mb-4">Tap to reveal</span>
            <h3 className="text-5xl font-extrabold text-slate-800 dark:text-white capitalize mb-4 text-center">{currentWord.word}</h3>
            <button 
                onClick={(e) => { e.stopPropagation(); onPlayAudio(currentWord.word); }}
                className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
            </button>
          </div>

          {/* Back */}
          <div className="absolute w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border-2 border-purple-100 dark:border-purple-900 flex flex-col p-8 backface-hidden rotate-y-180">
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
                    onClick={(e) => { e.stopPropagation(); handleNext(true); }}
                    className="py-3 px-2 flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 font-bold rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors border border-orange-200 dark:border-orange-900"
                >
                    <span className="text-sm">I Forgot</span>
                    <span className="text-[10px] uppercase opacity-70">Add to FFL</span>
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleNext(false); }}
                    className="py-3 px-4 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-bold rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors border border-purple-200 dark:border-purple-900"
                >
                    I Remember
                </button>
            </div>
          </div>
        </div>
      </div>
      
      <p className="text-center text-slate-400 dark:text-slate-500 text-sm mt-8">
        {isFlipped ? "Did you remember?" : "Tap the card to see the meaning"}
      </p>
    </div>
  );
};

export default Exam;