/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon, MagnifyingGlassIcon, PaperClipIcon, XMarkIcon, FolderOpenIcon, MusicalNoteIcon, PhotoIcon } from '@heroicons/react/24/solid';

interface InputAreaProps {
  onGenerate: (prompt: string, files: File[]) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

// Visual dots for the listening state
const VoiceVisualizer = () => (
    <div className="flex items-center justify-center space-x-3 h-12">
        <div className="w-4 h-4 rounded-full bg-google-blue animate-voice-1"></div>
        <div className="w-4 h-4 rounded-full bg-google-red animate-voice-2"></div>
        <div className="w-4 h-4 rounded-full bg-google-yellow animate-voice-3"></div>
        <div className="w-4 h-4 rounded-full bg-google-green animate-voice-4"></div>
    </div>
);

export const InputArea: React.FC<InputAreaProps> = ({ onGenerate, isGenerating, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onstart = () => setIsListening(true);
        
        recognitionRef.current.onresult = (event: any) => {
            const current = event.resultIndex;
            const transcriptText = event.results[current][0].transcript;
            setTranscript(transcriptText);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };
        
        recognitionRef.current.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
        recognitionRef.current?.stop();
    } else {
        setTranscript("");
        recognitionRef.current?.start();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim() || assetFiles.length > 0) {
        onGenerate(transcript, assetFiles);
        setTranscript("");
        setAssetFiles([]);
    }
  };

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        // Append new files to existing ones
        setAssetFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
    e.target.value = ''; // Reset input
  };

  const removeAsset = (index: number) => {
      setAssetFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Effect to auto-submit when speech ends
  useEffect(() => {
      if (!isListening && transcript && !isGenerating) {
          const timeout = setTimeout(() => {
             onGenerate(transcript, assetFiles);
             setTranscript("");
             setAssetFiles([]);
          }, 800);
          return () => clearTimeout(timeout);
      }
  }, [isListening, transcript, isGenerating, onGenerate, assetFiles]);

  return (
    <div className="w-full max-w-2xl mx-auto relative z-20">
      <div className={`transition-all duration-500 ease-in-out ${isListening ? 'scale-110' : 'scale-100'}`}>
        
        {/* Main Microphone Button Area */}
        <div className="flex flex-col items-center justify-center space-y-8">
            
            {/* The Orb / Button */}
            <button
                onClick={toggleListening}
                disabled={isGenerating || disabled}
                className={`
                    relative group flex items-center justify-center
                    w-24 h-24 rounded-full
                    transition-all duration-300
                    ${isListening 
                        ? 'bg-white shadow-[0_0_50px_rgba(255,255,255,0.3)]' 
                        : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700'
                    }
                    ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                {/* Ripple Effect when listening */}
                {isListening && (
                    <>
                        <div className="absolute inset-0 rounded-full border border-google-blue/30 animate-[ping_1.5s_linear_infinite]"></div>
                        <div className="absolute inset-0 rounded-full border border-google-red/30 animate-[ping_1.5s_linear_infinite_0.4s]"></div>
                    </>
                )}

                {isListening ? (
                    <div className="flex space-x-1">
                        <div className="w-1.5 h-6 bg-google-blue rounded-full animate-[pulse_0.5s_infinite]"></div>
                        <div className="w-1.5 h-10 bg-google-red rounded-full animate-[pulse_0.5s_infinite_0.1s]"></div>
                        <div className="w-1.5 h-8 bg-google-yellow rounded-full animate-[pulse_0.5s_infinite_0.2s]"></div>
                        <div className="w-1.5 h-6 bg-google-green rounded-full animate-[pulse_0.5s_infinite_0.3s]"></div>
                    </div>
                ) : (
                    <MicrophoneIcon className="w-10 h-10 text-zinc-300 group-hover:text-white transition-colors" />
                )}
            </button>

            {/* Transcript / Search Bar Display */}
            <div className="w-full relative flex flex-col space-y-4">
                <form onSubmit={handleManualSubmit} className="relative group w-full">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="w-5 h-5 text-zinc-500" />
                    </div>
                    
                    <input
                        type="text"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder={isListening ? "Listening..." : "Describe the app or game you want..."}
                        className={`
                            w-full bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 
                            text-white placeholder-zinc-500 rounded-full py-4 pl-12 pr-14
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent
                            transition-all duration-300 shadow-xl
                            ${isListening ? 'border-blue-500/50' : ''}
                        `}
                    />

                    {/* Quick Attachment Icon (Primary) */}
                    <div className="absolute inset-y-0 right-3 flex items-center">
                         <button 
                            type="submit" 
                            disabled={!transcript.trim() && assetFiles.length === 0}
                            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors disabled:opacity-0 disabled:pointer-events-none"
                         >
                            <MagnifyingGlassIcon className="w-4 h-4" />
                         </button>
                    </div>
                </form>

                {/* --- NEW ASSET UPLOAD SECTION --- */}
                <div className="w-full flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                        <label className="flex items-center space-x-2 cursor-pointer bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 transition-colors px-4 py-2 rounded-lg group">
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*,audio/*"
                                multiple
                                onChange={handleAssetUpload}
                                disabled={isGenerating}
                            />
                            <FolderOpenIcon className="w-4 h-4 text-zinc-400 group-hover:text-blue-400" />
                            <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200">
                                Upload Assets (Img/Audio)
                            </span>
                        </label>
                        <span className="text-[10px] text-zinc-600">Select files to add to the prompt</span>
                    </div>

                    {/* Asset List with Virtual Paths */}
                    {assetFiles.length > 0 && (
                        <div className="grid grid-cols-1 gap-2 bg-zinc-900/50 rounded-lg p-2 border border-zinc-800/50">
                            {assetFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded border border-zinc-700">
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                        {file.type.startsWith('audio') ? (
                                            <MusicalNoteIcon className="w-4 h-4 text-purple-400 shrink-0" />
                                        ) : (
                                            <PhotoIcon className="w-4 h-4 text-green-400 shrink-0" />
                                        )}
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs text-zinc-300 truncate">{file.name}</span>
                                            <span className="text-[10px] font-mono text-blue-400/80 truncate">
                                                /assets/uploads/{file.name.replace(/\s+/g, '_')}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => removeAsset(idx)} className="text-zinc-500 hover:text-red-400 ml-2">
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Processing State Indicator */}
                {isGenerating && (
                    <div className="absolute -bottom-10 left-0 right-0 flex justify-center">
                        <span className="text-xs font-medium text-zinc-400 tracking-widest uppercase animate-pulse">
                            Processing
                        </span>
                    </div>
                )}
                
                {/* Listening Visualizer */}
                {isListening && (
                    <div className="absolute -top-24 left-0 right-0 flex justify-center pointer-events-none">
                        <VoiceVisualizer />
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};