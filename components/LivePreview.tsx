/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { ArrowDownTrayIcon, PlusIcon, ViewColumnsIcon, DocumentIcon, CodeBracketIcon, XMarkIcon, ClipboardDocumentIcon, CommandLineIcon, SparklesIcon, AdjustmentsHorizontalIcon, CheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { Creation } from './CreationHistory';

interface LivePreviewProps {
  creation: Creation | null;
  isLoading: boolean;
  isFocused: boolean;
  onReset: () => void;
  onRefine: (prompt: string) => void;
}

// Add type definition for global libraries
declare global {
  interface Window {
    pdfjsLib: any;
    JSZip: any;
  }
}

const LoadingStep = ({ text, active, completed }: { text: string, active: boolean, completed: boolean }) => (
    <div className={`flex items-center space-x-3 transition-all duration-500 ${active || completed ? 'opacity-100 translate-x-0' : 'opacity-30 translate-x-4'}`}>
        <div className={`w-4 h-4 flex items-center justify-center ${completed ? 'text-green-400' : active ? 'text-blue-400' : 'text-zinc-700'}`}>
            {completed ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : active ? (
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
            ) : (
                <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full"></div>
            )}
        </div>
        <span className={`font-mono text-xs tracking-wide uppercase ${active ? 'text-zinc-200' : completed ? 'text-zinc-400 line-through' : 'text-zinc-600'}`}>{text}</span>
    </div>
);

const PdfRenderer = ({ dataUrl }: { dataUrl: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderPdf = async () => {
      if (!window.pdfjsLib) {
        setError("PDF library not initialized");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Load the document
        const loadingTask = window.pdfjsLib.getDocument(dataUrl);
        const pdf = await loadingTask.promise;
        
        // Get the first page
        const page = await pdf.getPage(1);
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        
        // Calculate scale to make it look good (High DPI)
        const viewport = page.getViewport({ scale: 2.0 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        setLoading(false);
      } catch (err) {
        console.error("Error rendering PDF:", err);
        setError("Could not render PDF preview.");
        setLoading(false);
      }
    };

    renderPdf();
  }, [dataUrl]);

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-6 text-center">
            <DocumentIcon className="w-12 h-12 mb-3 opacity-50 text-red-400" />
            <p className="text-sm mb-2 text-red-400/80">{error}</p>
        </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        )}
        <canvas 
            ref={canvasRef} 
            className={`max-w-full max-h-full object-contain shadow-xl border border-zinc-800/50 rounded transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
        />
    </div>
  );
};

export const LivePreview: React.FC<LivePreviewProps> = ({ creation, isLoading, isFocused, onReset, onRefine }) => {
    const [loadingStep, setLoadingStep] = useState(0);
    const [showSplitView, setShowSplitView] = useState(false);
    const [showDevTools, setShowDevTools] = useState(false);
    const [refinePrompt, setRefinePrompt] = useState("");
    const [copiedState, setCopiedState] = useState<string | null>(null);

    // Handle loading animation steps
    useEffect(() => {
        if (isLoading) {
            setLoadingStep(0);
            const interval = setInterval(() => {
                setLoadingStep(prev => (prev < 3 ? prev + 1 : prev));
            }, 2000); 
            return () => clearInterval(interval);
        } else {
            setLoadingStep(0);
        }
    }, [isLoading]);

    // Default to Split View when a new creation with an image is loaded
    useEffect(() => {
        if (creation?.originalImage) {
            setShowSplitView(true);
        } else {
            setShowSplitView(false);
        }
    }, [creation]);

    const handleDownloadZip = async () => {
        if (!creation?.html) return;
        if (!window.JSZip) {
            alert("Zip library not loaded. Please refresh.");
            return;
        }

        try {
            const zip = new window.JSZip();
            zip.file("index.html", creation.html);
            const blob = await zip.generateAsync({type:"blob"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Zip export failed", e);
        }
    };

    const handleDownloadBlogger = () => {
        if (!creation?.html) return;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(creation.html, 'text/html');

            // 1. Extract and Remove CSS for <b:skin>
            const styleTags = doc.querySelectorAll('style');
            const styles = Array.from(styleTags).map(s => s.textContent).join('\n');
            styleTags.forEach(el => el.remove());
            
            // 2. Extract and Remove Inline JS for safe CDATA injection
            const scriptTags = doc.querySelectorAll('script');
            const inlineScripts: string[] = [];
            // We keep external scripts (src attribute) in the body, but remove inline ones
            scriptTags.forEach(el => {
                if (!el.src && el.textContent) {
                    inlineScripts.push(el.textContent);
                    el.remove();
                }
            });

            // 3. Serialize Body to XHTML (Strict XML for Blogger)
            const serializer = new XMLSerializer();
            // Serialize body and remove the outer <body> tags to get just the content
            let bodyContent = serializer.serializeToString(doc.body);
            // Quick regex to strip the start and end body tag, keeping attributes if any, though usually clean
            bodyContent = bodyContent.replace(/^<body[^>]*>/, '').replace(/<\/body>$/, '');

            // 4. Construct the Blogger XML Template
            const bloggerTemplate = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html b:version='2' class='v2' expr:dir='data:blog.languageDirection' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head>
    <meta content='width=device-width, initial-scale=1' name='viewport'/>
    <title><data:blog.pageTitle/></title>
    <b:skin><![CDATA[
/* --- Generated App Styles --- */
${styles}

/* --- Basic Blogger Resets --- */
.section, .widget { margin: 0; padding: 0; }
body { margin: 0; padding: 0; background-color: #ffffff; color: #000000; }
    ]]></b:skin>
    <!-- Tailwind CSS (CDN) -->
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <!-- 
      GEMINI GENERATED APPLICATION 
      This section contains the generated interface.
    -->
    <div id="gemini-app-container">
        ${bodyContent}
    </div>

    <!-- 
      BLOG POSTS SECTION
      Required by Blogger to function correctly. 
      You can move this section to change where posts appear relative to the app.
    -->
    <b:section class='main' id='main' showaddelement='yes'>
        <b:widget id='Blog1' locked='false' title='Blog Posts' type='Blog'/>
    </b:section>

    <!-- Generated Application Logic -->
    <script>
    //<![CDATA[
        ${inlineScripts.join('\n\n')}
    //]]>
    </script>
</body>
</html>`;

            const blob = new Blob([bloggerTemplate], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-blogger-theme.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (e) {
            console.error("Blogger export failed", e);
            alert("Failed to convert to Blogger XML. The generated code might be too complex for XML serialization.");
        }
    };

    const extractCode = (type: 'html' | 'css' | 'js') => {
        if (!creation?.html) return '';
        const html = creation.html;
        
        if (type === 'css') {
            const match = html.match(/<style>([\s\S]*?)<\/style>/);
            return match ? match[1].trim() : '/* No internal CSS found */';
        }
        if (type === 'js') {
             const match = html.match(/<script>([\s\S]*?)<\/script>/);
             return match ? match[1].trim() : '// No internal JS found';
        }
        if (type === 'html') {
            // Very basic strip, remove style and script tags content
            let clean = html.replace(/<style>[\s\S]*?<\/style>/g, '<!-- CSS Removed -->');
            clean = clean.replace(/<script>[\s\S]*?<\/script>/g, '<!-- JS Removed -->');
            return clean.trim();
        }
        return '';
    };

    const copyToClipboard = (text: string, id: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedState(id);
            setTimeout(() => setCopiedState(null), 2000);
        }).catch(err => console.error('Copy failed', err));
    };

    const handleRefineSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (refinePrompt.trim()) {
            onRefine(refinePrompt);
            setRefinePrompt("");
        }
    };

  return (
    <div
      className={`
        fixed z-40 flex flex-col
        rounded-lg overflow-hidden border border-zinc-800 bg-[#0E0E10] shadow-2xl
        transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)
        ${isFocused
          ? 'inset-2 md:inset-4 opacity-100 scale-100'
          : 'top-1/2 left-1/2 w-[90%] h-[60%] -translate-x-1/2 -translate-y-1/2 opacity-0 scale-95 pointer-events-none'
        }
      `}
    >
      {/* Minimal Technical Header */}
      <div className="bg-[#121214] px-4 py-3 flex items-center justify-between border-b border-zinc-800 shrink-0">
        {/* Left: Controls */}
        <div className="flex items-center space-x-3 w-32">
           <div className="flex space-x-2 group/controls">
                <button 
                  onClick={onReset}
                  className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-red-500 hover:!bg-red-600 transition-colors flex items-center justify-center focus:outline-none"
                  title="Close Preview"
                >
                  <XMarkIcon className="w-2 h-2 text-black opacity-0 group-hover/controls:opacity-100" />
                </button>
                <div className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-yellow-500 transition-colors"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-green-500 transition-colors"></div>
           </div>
        </div>
        
        {/* Center: Title */}
        <div className="flex items-center space-x-2 text-zinc-500">
            <CodeBracketIcon className="w-3 h-3" />
            <span className="text-[11px] font-mono uppercase tracking-wider">
                {isLoading ? 'System Processing...' : creation ? creation.name : 'Preview Mode'}
            </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center justify-end space-x-1 w-32">
            {!isLoading && creation && (
                <>
                     <button 
                        onClick={() => setShowDevTools(!showDevTools)}
                        title="Developer Tools / Copy Code"
                        className={`p-1.5 rounded-md transition-all ${showDevTools ? 'bg-zinc-800 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                    >
                        <AdjustmentsHorizontalIcon className="w-4 h-4" />
                    </button>

                    {creation.originalImage && (
                         <button 
                            onClick={() => setShowSplitView(!showSplitView)}
                            title={showSplitView ? "Show App Only" : "Compare with Original"}
                            className={`p-1.5 rounded-md transition-all ${showSplitView ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <ViewColumnsIcon className="w-4 h-4" />
                        </button>
                    )}

                    <button 
                        onClick={onReset}
                        title="New Upload"
                        className="ml-2 flex items-center space-x-1 text-xs font-bold bg-white text-black hover:bg-zinc-200 px-3 py-1.5 rounded-md transition-colors"
                    >
                        <PlusIcon className="w-3 h-3" />
                        <span className="hidden sm:inline">New</span>
                    </button>
                </>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative w-full flex-1 bg-[#09090b] flex overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 w-full">
             {/* Technical Loading State */}
             <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 mb-6 text-blue-500 animate-spin-slow">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-zinc-100 font-mono text-lg tracking-tight">Constructing Environment</h3>
                    <p className="text-zinc-500 text-sm mt-2">Interpreting visual data...</p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-[loading_3s_ease-in-out_infinite] w-1/3"></div>
                </div>

                 {/* Terminal Steps */}
                 <div className="border border-zinc-800 bg-black/50 rounded-lg p-4 space-y-3 font-mono text-sm">
                     <LoadingStep text="Analyzing visual inputs" active={loadingStep === 0} completed={loadingStep > 0} />
                     <LoadingStep text="Identifying UI patterns" active={loadingStep === 1} completed={loadingStep > 1} />
                     <LoadingStep text="Generating functional logic" active={loadingStep === 2} completed={loadingStep > 2} />
                     <LoadingStep text="Compiling preview" active={loadingStep === 3} completed={loadingStep > 3} />
                 </div>
             </div>
          </div>
        ) : creation?.html ? (
          <>
            <div className="flex flex-1 relative overflow-hidden">
                {/* Split View: Left Panel (Original Image) */}
                {showSplitView && creation.originalImage && (
                    <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-zinc-800 bg-[#0c0c0e] relative flex items-center justify-center shrink-0">
                        <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur text-zinc-400 text-[10px] font-mono uppercase px-2 py-1 rounded border border-zinc-800">
                            Input Source
                        </div>
                        <div className="w-full h-full p-6 flex items-center justify-center">
                            {creation.originalImage.startsWith('data:application/pdf') ? (
                                <PdfRenderer dataUrl={creation.originalImage} />
                            ) : (
                                <img 
                                    src={creation.originalImage} 
                                    alt="Original Input" 
                                    className="max-w-full max-h-full object-contain shadow-xl border border-zinc-800/50 rounded"
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* App Preview Panel */}
                <div className={`relative h-full bg-white transition-all duration-500 ${showSplitView && creation.originalImage ? 'w-full md:w-1/2 h-1/2 md:h-full' : 'w-full'}`}>
                    <iframe
                        title="Gemini Live Preview"
                        srcDoc={creation.html}
                        className="w-full h-full"
                        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                    />
                </div>
            </div>

            {/* DevTools / Refinement Sidebar */}
            {showDevTools && (
                <div className="w-80 border-l border-zinc-800 bg-[#121214] flex flex-col shrink-0 animate-in slide-in-from-right duration-300">
                     <div className="p-4 border-b border-zinc-800">
                         <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Export Code</h3>
                     </div>
                     
                     {/* Copy Buttons */}
                     <div className="p-4 space-y-3">
                         <button 
                            onClick={() => copyToClipboard(creation.html, 'full')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors group ${
                                copiedState === 'full' 
                                ? 'bg-green-900/30 text-green-400 border border-green-900/50' 
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                            }`}
                         >
                            <span className="font-mono text-xs">
                                {copiedState === 'full' ? 'Copied Successfully' : 'Copy Full Template'}
                            </span>
                            {copiedState === 'full' ? (
                                <CheckIcon className="w-4 h-4 text-green-400" />
                            ) : (
                                <ClipboardDocumentIcon className="w-4 h-4 text-zinc-500 group-hover:text-white" />
                            )}
                         </button>

                         <button 
                            onClick={handleDownloadZip}
                            className="w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors group bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                         >
                            <span className="font-mono text-xs">Download ZIP</span>
                            <ArrowDownTrayIcon className="w-4 h-4 text-zinc-500 group-hover:text-white" />
                         </button>

                         <button 
                            onClick={handleDownloadBlogger}
                            className="w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors group bg-orange-900/20 hover:bg-orange-900/40 border border-orange-900/50 text-orange-200"
                         >
                            <span className="font-mono text-xs">Download Blogger XML</span>
                            <GlobeAltIcon className="w-4 h-4 text-orange-500 group-hover:text-orange-300" />
                         </button>
                         
                         <div className="grid grid-cols-3 gap-2">
                             <button 
                                onClick={() => copyToClipboard(extractCode('html'), 'html')}
                                className={`flex flex-col items-center justify-center p-2 rounded text-center transition-colors group border ${
                                    copiedState === 'html' 
                                    ? 'bg-green-900/20 border-green-900/50' 
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                                }`}
                             >
                                <span className={`text-[10px] font-bold mb-1 ${copiedState === 'html' ? 'text-green-400' : 'text-orange-500'}`}>
                                    {copiedState === 'html' ? 'COPIED' : 'HTML'}
                                </span>
                                {copiedState === 'html' ? (
                                    <CheckIcon className="w-3 h-3 text-green-400" />
                                ) : (
                                    <ClipboardDocumentIcon className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
                                )}
                             </button>
                             
                             <button 
                                onClick={() => copyToClipboard(extractCode('css'), 'css')}
                                className={`flex flex-col items-center justify-center p-2 rounded text-center transition-colors group border ${
                                    copiedState === 'css' 
                                    ? 'bg-green-900/20 border-green-900/50' 
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                                }`}
                             >
                                <span className={`text-[10px] font-bold mb-1 ${copiedState === 'css' ? 'text-green-400' : 'text-blue-400'}`}>
                                    {copiedState === 'css' ? 'COPIED' : 'CSS'}
                                </span>
                                {copiedState === 'css' ? (
                                    <CheckIcon className="w-3 h-3 text-green-400" />
                                ) : (
                                    <ClipboardDocumentIcon className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
                                )}
                             </button>

                             <button 
                                onClick={() => copyToClipboard(extractCode('js'), 'js')}
                                className={`flex flex-col items-center justify-center p-2 rounded text-center transition-colors group border ${
                                    copiedState === 'js' 
                                    ? 'bg-green-900/20 border-green-900/50' 
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                                }`}
                             >
                                <span className={`text-[10px] font-bold mb-1 ${copiedState === 'js' ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {copiedState === 'js' ? 'COPIED' : 'JS'}
                                </span>
                                {copiedState === 'js' ? (
                                    <CheckIcon className="w-3 h-3 text-green-400" />
                                ) : (
                                    <ClipboardDocumentIcon className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
                                )}
                             </button>
                         </div>
                     </div>

                     <div className="border-t border-zinc-800 p-4 flex-1 flex flex-col">
                        <div className="flex items-center space-x-2 mb-3">
                            <SparklesIcon className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Refine & Edit</h3>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                            Don't like the result? Describe what you want to change, and the engine will rewrite the code.
                        </p>
                        
                        <form onSubmit={handleRefineSubmit} className="flex-1 flex flex-col">
                            <textarea
                                value={refinePrompt}
                                onChange={(e) => setRefinePrompt(e.target.value)}
                                placeholder="e.g. Make the background dark blue, add a footer, or make the buttons larger..."
                                className="w-full flex-1 bg-zinc-900 border border-zinc-700 focus:border-blue-500 rounded p-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none transition-colors"
                            />
                            <button 
                                type="submit"
                                disabled={!refinePrompt.trim()}
                                className="mt-3 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                            >
                                <CommandLineIcon className="w-4 h-4" />
                                <span>Apply Changes</span>
                            </button>
                        </form>
                     </div>
                </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};