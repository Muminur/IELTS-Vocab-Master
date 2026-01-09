import React, { useMemo } from 'react';
import { WordDetails } from '../types';

interface MindMapProps {
  data: WordDetails;
  onPlayAudio: (text: string) => void;
}

const MindMap: React.FC<MindMapProps> = ({ data, onPlayAudio }) => {
  // Dimensions
  const width = 900;
  const height = 650;
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Layout Configuration
  const radiusX = 280; // Horizontal spread
  const radiusY = 220; // Vertical spread

  // Semantic Colors for different node types
  // Updated with dark mode support
  const theme = {
    word: { bg: 'bg-blue-600', border: 'border-blue-200', text: 'text-white', shadow: 'shadow-blue-500/40' },
    pos: { 
        stroke: '#64748b', 
        bg: 'bg-slate-50 dark:bg-slate-800', 
        border: 'border-slate-200 dark:border-slate-700', 
        text: 'text-slate-700 dark:text-slate-200', 
        label: 'text-slate-400 dark:text-slate-500' 
    },
    definition: { 
        stroke: '#7c3aed', 
        bg: 'bg-purple-50 dark:bg-purple-900/20', 
        border: 'border-purple-200 dark:border-purple-800', 
        text: 'text-purple-900 dark:text-purple-200', 
        label: 'text-purple-400 dark:text-purple-400' 
    },
    example: { 
        stroke: '#d97706', 
        bg: 'bg-amber-50 dark:bg-amber-900/20', 
        border: 'border-amber-200 dark:border-amber-800', 
        text: 'text-amber-900 dark:text-amber-200', 
        label: 'text-amber-500 dark:text-amber-500' 
    },
    collocation: { 
        stroke: '#e11d48', 
        bg: 'bg-rose-50 dark:bg-rose-900/20', 
        border: 'border-rose-200 dark:border-rose-800', 
        text: 'text-rose-900 dark:text-rose-200', 
        label: 'text-rose-400 dark:text-rose-400' 
    },
    synonym: { 
        stroke: '#059669', 
        bg: 'bg-emerald-50 dark:bg-emerald-900/20', 
        border: 'border-emerald-200 dark:border-emerald-800', 
        text: 'text-emerald-900 dark:text-emerald-200', 
        label: 'text-emerald-500 dark:text-emerald-500' 
    },
    antonym: { 
        stroke: '#475569', 
        bg: 'bg-gray-50 dark:bg-gray-800', 
        border: 'border-gray-200 dark:border-gray-700', 
        text: 'text-gray-800 dark:text-gray-200', 
        label: 'text-gray-400 dark:text-gray-500' 
    },
  };

  const nodes = useMemo(() => {
    // Define the nodes with their specific angles and types
    const items = [
      { 
        id: 'pos', 
        type: 'pos' as keyof typeof theme, 
        label: 'Part of Speech', 
        text: data.partOfSpeech, 
        angle: -90 
      },
      { 
        id: 'definition', 
        type: 'definition' as keyof typeof theme, 
        label: 'Definition', 
        text: data.definition, 
        angle: -30 
      },
      { 
        id: 'example', 
        type: 'example' as keyof typeof theme, 
        label: 'Example', 
        text: `"${data.example}"`, 
        angle: 45 
      },
      { 
        id: 'collocation', 
        type: 'collocation' as keyof typeof theme, 
        label: 'Collocations', 
        text: data.collocations.slice(0, 3).join(', '), 
        angle: 135 
      },
      { 
        id: 'synonym', 
        type: 'synonym' as keyof typeof theme, 
        label: 'Synonyms', 
        text: data.synonyms.slice(0, 3).join(', '), 
        angle: 225 
      },
    ];

    // Optional: Add Antonyms if they exist and fit nicely, 
    // replacing a slot or squeezing in could be complex, 
    // so we stick to a balanced 5-node star for consistency unless we want to dynamically adjust.

    return items.map((item) => {
      const radian = (item.angle * Math.PI) / 180;
      return {
        ...item,
        x: centerX + radiusX * Math.cos(radian),
        y: centerY + radiusY * Math.sin(radian),
        colors: theme[item.type],
      };
    });
  }, [data, centerX, centerY, radiusX, radiusY]);

  const handleNodeClick = (e: React.MouseEvent, text: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Strip quotes for playback if present
    const cleanText = text.replace(/^"|"$/g, '');
    onPlayAudio(cleanText);
  };

  return (
    <div className="w-full overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xl relative transition-colors duration-300">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]"></div>
      
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto min-h-[500px]"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {/* Gradients for connecting lines */}
          {nodes.map((node) => (
             <linearGradient key={`grad-${node.id}`} id={`grad-${node.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.6" />
                <stop offset="100%" stopColor={node.colors.stroke} stopOpacity="0.8" />
             </linearGradient>
          ))}
        </defs>

        {/* Connecting Lines */}
        {nodes.map((node, i) => {
            // Calculate a control point for a quadratic bezier curve to give it a natural flow
            // Pulling the control point slightly towards the center vertically for a nicer arc
            const cpX = (centerX + node.x) / 2;
            const cpY = (centerY + node.y) / 2; // Linear midpoint
            
            // Adjust control point to curve outward slightly
            // We can add a slight perpendicular offset if we want more "organic" look, 
            // but a straight-ish curve (Q) is often cleaner. 
            // Let's use Q command: M start Q control end
            
            return (
                <g key={`link-${i}`} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                    <path
                        d={`M${centerX},${centerY} Q${cpX},${cpY} ${node.x},${node.y}`}
                        stroke={`url(#grad-${node.id})`}
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        className="opacity-50 transition-all duration-500"
                    />
                    {/* Small dot moving along the line animation could go here, but kept static for performance */}
                </g>
            );
        })}

        {/* Outer Nodes */}
        {nodes.map((node, i) => (
          <foreignObject
            key={node.id}
            x={node.x - 90}
            y={node.y - 70}
            width="180"
            height="140"
            className="overflow-visible group perspective-1000"
            style={{ animationDelay: `${i * 100 + 300}ms` }}
          >
            <div 
                onClick={(e) => handleNodeClick(e, node.text)}
                onContextMenu={(e) => handleNodeClick(e, node.text)}
                className={`
                    w-full h-full rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer
                    border-2 shadow-lg transition-all duration-300 ease-out
                    hover:scale-110 hover:shadow-xl hover:z-50 hover:-translate-y-1
                    ${node.colors.bg} ${node.colors.border}
                `}
            >
                <span className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${node.colors.label}`}>
                    {node.label}
                </span>
                <p className={`text-sm font-semibold leading-snug line-clamp-4 break-words w-full ${node.colors.text}`}>
                    {node.text}
                </p>
                
                {/* Subtle indicator to listen */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className={`w-4 h-4 ${node.colors.label}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                </div>
            </div>
          </foreignObject>
        ))}

        {/* Center Node (Word) */}
        <foreignObject
            x={centerX - 100}
            y={centerY - 100}
            width="200"
            height="200"
            className="overflow-visible"
        >
            <div 
                onClick={(e) => handleNodeClick(e, data.word)}
                onContextMenu={(e) => handleNodeClick(e, data.word)}
                className={`
                    w-full h-full rounded-full flex items-center justify-center
                    bg-gradient-to-br from-blue-600 to-indigo-600 
                    border-4 border-blue-100 dark:border-blue-900 shadow-2xl shadow-blue-500/40
                    cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95
                    relative z-10
                `}
            >
                <div className="text-center p-4">
                    <h1 className="text-3xl font-extrabold text-white capitalize drop-shadow-md break-words">
                        {data.word}
                    </h1>
                    <div className="mt-2 text-blue-200 text-xs font-medium uppercase tracking-wider flex items-center justify-center gap-1 opacity-80">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        Listen
                    </div>
                </div>
            </div>
        </foreignObject>
      </svg>
    </div>
  );
};

export default MindMap;