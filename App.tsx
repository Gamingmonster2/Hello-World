/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Hero } from './components/Hero';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { CreationHistory, Creation } from './components/CreationHistory';
import { bringToLife, refineCode, ImagePart } from './services/gemini';

const App: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<Creation[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load history
  useEffect(() => {
    const initHistory = async () => {
      const saved = localStorage.getItem('gemini_app_history');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setHistory(parsed.map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) })));
        } catch (e) { console.error(e); }
      }
    };
    initHistory();
  }, []);

  // Save history
  useEffect(() => {
    if (history.length > 0) {
        localStorage.setItem('gemini_app_history', JSON.stringify(history));
    }
  }, [history]);

  const fileToBase64 = (file: File): Promise<{data: string, mimeType: string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // extract base64 part
          const base64 = reader.result.split(',')[1];
          resolve({ data: base64, mimeType: file.type.toLowerCase() });
        } else {
          reject(new Error('Failed to convert file'));
        }
      };
      reader.onerror = reject;
    });
  };

  const handleApiError = (error: any) => {
    console.error("Full API Error Object:", error);
    
    // Attempt to extract the error message from various possible structures
    // 1. Standard Error object: error.message
    // 2. JSON Error response: error.error.message or error.error.code
    let msg = "";
    
    if (error?.error?.message) {
        msg = error.error.message;
    } else if (error?.message) {
        msg = error.message;
    } else {
        msg = JSON.stringify(error);
    }
    
    msg = msg.toLowerCase();

    // Check for quota indicators
    const isQuotaError = 
        msg.includes('429') || 
        msg.includes('quota') || 
        msg.includes('resource_exhausted') ||
        error?.error?.code === 429 ||
        error?.status === 429;

    if (isQuotaError) {
      alert(
        "⚠️ API QUOTA LIMIT REACHED\n\n" +
        "We automatically retried the request, but the API quota is still exhausted.\n\n" +
        "This usually means your Google AI Studio API key has hit its daily limit or request rate limit.\n\n" + 
        "Please try again in a minute, or use a new API Key."
      );
    } else {
      alert("Browser engine failed to render.\n\nError Details: " + (msg.slice(0, 200) || "Unknown error occurred."));
    }
  };

  const handleGenerate = async (promptText: string, file: File | null) => {
    setIsGenerating(true);
    setActiveCreation(null);

    try {
      const imageParts: ImagePart[] = [];
      let imageUrl: string | undefined = undefined;

      if (file) {
          const { data, mimeType } = await fileToBase64(file);
          imageParts.push({ inlineData: { data, mimeType } });
          imageUrl = `data:${mimeType};base64,${data}`;
      }

      const html = await bringToLife(promptText, imageParts);
      
      if (html) {
        const newCreation: Creation = {
          id: crypto.randomUUID(),
          name: promptText.slice(0, 30) || (file ? `Image Analysis` : 'Voice Search Result'),
          html: html,
          originalImage: imageUrl,
          timestamp: new Date(),
        };
        setActiveCreation(newCreation);
        setHistory(prev => [newCreation, ...prev]);
      }

    } catch (error) {
      handleApiError(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (refinementPrompt: string) => {
    if (!activeCreation) return;

    setIsGenerating(true);
    try {
        const updatedHtml = await refineCode(activeCreation.html, refinementPrompt);
        
        const refinedCreation: Creation = {
            ...activeCreation,
            id: crypto.randomUUID(),
            name: `${activeCreation.name} (Refined)`,
            html: updatedHtml,
            timestamp: new Date()
        };

        setActiveCreation(refinedCreation);
        setHistory(prev => [refinedCreation, ...prev]);

    } catch (error) {
        handleApiError(error);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setActiveCreation(null);
    setIsGenerating(false);
  };

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="h-[100dvh] bg-black text-zinc-100 selection:bg-blue-500/30 overflow-hidden relative font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 blur-[120px] rounded-full"></div>
      </div>

      {/* GitHub Integration Link (Top Right) */}
      <div 
        className={`absolute top-6 right-6 z-30 transition-opacity duration-500 ${isFocused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-full transition-all group backdrop-blur-sm"
          >
             <span className="text-xs font-mono text-zinc-400 group-hover:text-white">Publish to GitHub</span>
             <svg viewBox="0 0 24 24" className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" fill="currentColor">
                 <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
             </svg>
          </a>
      </div>

      {/* Main Content */}
      <div 
        className={`
          relative z-10 flex flex-col items-center justify-center h-full w-full max-w-5xl mx-auto px-6
          transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)
          ${isFocused ? 'opacity-0 scale-90 pointer-events-none blur-md' : 'opacity-100 scale-100 blur-0'}
        `}
      >
          <div className="mb-12">
              <Hero />
          </div>

          <div className="w-full">
              <InputArea onGenerate={handleGenerate} isGenerating={isGenerating} disabled={isFocused} />
          </div>

          {/* Footer History Links */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
             {history.length > 0 && (
                 <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                    {history.slice(0, 3).map(h => (
                        <button key={h.id} onClick={() => setActiveCreation(h)} className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full truncate max-w-[120px]">
                            {h.name}
                        </button>
                    ))}
                 </div>
             )}
          </div>
      </div>

      {/* Live Preview Overlay */}
      <LivePreview
        creation={activeCreation}
        isLoading={isGenerating}
        isFocused={isFocused}
        onReset={handleReset}
        onRefine={handleRefine}
      />
    </div>
  );
};

export default App;