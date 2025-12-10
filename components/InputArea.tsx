/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon, MagnifyingGlassIcon, PaperClipIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface InputAreaProps {
  onGenerate: (prompt: string, file: File | null) => void;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    if (transcript.trim() || selectedFile) {
        onGenerate(transcript, selectedFile);
        setTranscript("");
        setSelectedFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  // Effect to auto-submit when speech ends
  useEffect(() => {
      if (!isListening && transcript && !isGenerating) {
          // If a file is selected, we usually want the user to confirm, but for voice fluidity we can auto-send
          // or wait. Let's wait a bit to see if they keep talking, then send.
          const timeout = setTimeout(() => {
             onGenerate(transcript, selectedFile);
             setTranscript("");
             setSelectedFile(null);
          }, 800);
          return () => clearTimeout(timeout);
      }
  }, [isListening, transcript, isGenerating, onGenerate, selectedFile]);

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
            <div className="w-full relative">
                <form onSubmit={handleManualSubmit} className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="w-5 h-5 text-zinc-500" />
                    </div>
                    
                    <input
                        type="text"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder={isListening ? "Listening..." : "Say something or type URL..."}
                        className={`
                            w-full bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 
                            text-white placeholder-zinc-500 rounded-full py-4 pl-12 pr-14
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent
                            transition-all duration-300 shadow-xl
                            ${isListening ? 'border-blue-500/50' : ''}
                        `}
                    />

                    {/* File Upload Attachment Icon */}
                    <div className="absolute inset-y-0 right-3 flex items-center">
                        <label className="p-2 rounded-full hover:bg-zinc-800 cursor-pointer transition-colors relative">
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={isGenerating}
                            />
                            {selectedFile ? (
                                <div className="relative">
                                    <PaperClipIcon className="w-5 h-5 text-blue-400" />
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border border-zinc-900"></div>
                                </div>
                            ) : (
                                <PaperClipIcon className="w-5 h-5 text-zinc-500" />
                            )}
                        </label>
                    </div>
                </form>

                {/* Selected File Indicator (if manual typing) */}
                {selectedFile && (
                    <div className="absolute top-full left-0 mt-2 flex items-center space-x-2 bg-zinc-800/50 px-3 py-1 rounded-lg border border-zinc-700">
                        <span className="text-xs text-zinc-300 truncate max-w-[200px]">{selectedFile.name}</span>
                        <button 
                            onClick={() => setSelectedFile(null)}
                            className="text-zinc-500 hover:text-white"
                        >
                            <XMarkIcon className="w-3 h-3" />
                        </button>
                    </div>
                )}

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