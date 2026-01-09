import React from 'react';
import { WordDetails } from '../types';

interface WordCardProps {
  data: WordDetails;
  onPlayWord: (text: string) => void;
  playingWord: string | null;
  onSave?: () => void;
  isSaved?: boolean;
}

const WordCard: React.FC<WordCardProps> = ({ data, onPlayWord, playingWord, onSave, isSaved }) => {
  const isPlayingMain = playingWord === data.word;

  const renderWordItem = (word: string, colorClass: string, bgClass: string, borderClass: string, darkColorClass: string, darkBgClass: string, darkBorderClass: string) => {
     const isPlaying = playingWord === word;
     return (
        <div key={word} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${bgClass} ${borderClass} dark:bg-opacity-20 ${darkBgClass} ${darkBorderClass} border shadow-sm transition-transform hover:scale-105`}>
            <span className={`text-sm font-semibold ${colorClass} ${darkColorClass}`}>{word}</span>
            <button 
                onClick={(e) => { e.stopPropagation(); onPlayWord(word); }}
                className={`p-1 rounded-full hover:bg-white/60 dark:hover:bg-black/30 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 ${colorClass} ${darkColorClass}`}
                title="Listen"
                disabled={!!playingWord}
            >
                {isPlaying ? (
                     <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                         <path d="M10 3.5a.5.5 0 00-.5-.5H5.807L2.454 5.925A2 2 0 002 7.425v5.15a2 2 0 00.454 1.5l3.353 2.925H9.5a.5.5 0 00.5-.5v-13zM12.5 5a.5.5 0 01.5.5v9a.5.5 0 01-1 0v-9a.5.5 0 01.5-.5z" />
                         <path d="M15.5 7.5a.5.5 0 01.5.5v4a.5.5 0 01-1 0v-4a.5.5 0 01.5-.5z" />
                    </svg>
                )}
            </button>
        </div>
     );
  };

  return (
    <div className="bg-white dark:bg-slate-850 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 overflow-hidden mb-8 relative transition-colors duration-300">
        {onSave && (
            <button 
                onClick={onSave}
                disabled={isSaved}
                className={`absolute top-4 right-4 z-10 p-3 rounded-full transition-all duration-500 ease-out transform ${
                    isSaved 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-110 rotate-0' 
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md hover:scale-110 hover:rotate-6 shadow-sm'
                }`}
                title={isSaved ? "Saved to your list" : "Save word"}
                aria-label={isSaved ? "Saved" : "Save word"}
            >
                {isSaved ? (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                )}
            </button>
        )}

      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-indigo-900 p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="pr-12">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight capitalize">
              {data.word}
            </h2>
            {data.ipa && (
                <span className="text-blue-200 text-xl md:text-2xl font-serif tracking-wide opacity-90">
                    /{data.ipa}/
                </span>
            )}
            <span className="text-blue-200 text-lg font-medium italic">
              {data.partOfSpeech}
            </span>
          </div>
        </div>
        
        <button
          onClick={() => onPlayWord(data.word)}
          disabled={!!playingWord}
          className={`mt-4 md:mt-0 flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-200 shadow-md ${
            isPlayingMain
              ? 'bg-rose-500 text-white animate-pulse cursor-not-allowed'
              : 'bg-white text-blue-700 dark:bg-slate-800 dark:text-blue-400 hover:bg-blue-50 hover:scale-105 active:scale-95'
          } disabled:opacity-70`}
        >
          {isPlayingMain ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
          <span>{isPlayingMain ? 'Playing...' : 'Pronunciation'}</span>
        </button>
      </div>

      {/* Details Grid */}
      <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Definition */}
        <div className="col-span-1 md:col-span-2">
          <h3 className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Meaning</h3>
          <p className="text-xl text-gray-800 dark:text-gray-100 leading-relaxed font-medium">
            {data.definition}
          </p>
        </div>

        {/* Example */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-5 border border-amber-100 dark:border-amber-800/50 col-span-1 md:col-span-2">
            <h3 className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Example Sentence
            </h3>
            <p className="text-lg text-amber-900 dark:text-amber-100 italic font-serif">
                "{data.example}"
            </p>
        </div>

        {/* Collocations */}
        <div>
          <h3 className="text-rose-500 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-3">Collocations</h3>
          <ul className="space-y-2">
            {data.collocations.map((col, idx) => (
              <li key={idx} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                <span>{col}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Synonyms & Antonyms */}
        <div>
          <div className="mb-6">
            <h3 className="text-emerald-500 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">Synonyms</h3>
            <div className="flex flex-wrap gap-2">
              {data.synonyms.map((syn) => renderWordItem(syn, 'text-emerald-700', 'bg-emerald-50', 'border-emerald-100', 'dark:text-emerald-300', 'dark:bg-emerald-900', 'dark:border-emerald-800'))}
            </div>
          </div>

          {data.antonyms && data.antonyms.length > 0 && (
            <div>
              <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Antonyms</h3>
               <div className="flex flex-wrap gap-2">
                  {data.antonyms.map((ant) => renderWordItem(ant, 'text-slate-600', 'bg-slate-100', 'border-slate-200', 'dark:text-slate-300', 'dark:bg-slate-800', 'dark:border-slate-700'))}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordCard;