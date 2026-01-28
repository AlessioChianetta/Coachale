
import React, { useState, useMemo, useEffect } from 'react';
import { analyzeAdText, generateImageConcept } from './services/geminiService';
import { AdAnalysis, GeneratedImage, VisualConcept, AppSettings, PostInput, SocialPlatform } from './types';

const App: React.FC = () => {
  const [postInputs, setPostInputs] = useState<PostInput[]>(() => {
    const saved = localStorage.getItem('advisage_infinite_v3');
    return saved ? JSON.parse(saved) : [{ id: 'init-1', text: '', platform: 'instagram' }];
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('advisage_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('advisage_settings_v3');
    return saved ? JSON.parse(saved) : {
      mood: 'professional',
      stylePreference: 'realistic',
      brandColor: '#6366f1',
      brandFont: 'Inter',
      manualApiKey: '',
      externalSourceUrl: ''
    };
  });
  
  const [batchResults, setBatchResults] = useState<AdAnalysis[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isBatchRendering, setIsBatchRendering] = useState(false);
  const [isFetchingFromSource, setIsFetchingFromSource] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [variantToggle, setVariantToggle] = useState<Record<string, 'clean' | 'text'>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'factory' | 'pitch'>('factory');

  useEffect(() => {
    localStorage.setItem('advisage_infinite_v3', JSON.stringify(postInputs));
    localStorage.setItem('advisage_settings_v3', JSON.stringify(settings));
    localStorage.setItem('advisage_theme', theme);
  }, [postInputs, settings, theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const addPostInput = () => setPostInputs([...postInputs, { id: Math.random().toString(36).substr(2, 9), text: '', platform: 'instagram' }]);
  
  const updatePost = (id: string, updates: Partial<PostInput>) => setPostInputs(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

  const removePostInput = (id: string) => {
    if (postInputs.length > 1) {
      setPostInputs(prev => prev.filter(p => p.id !== id));
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'advisage-export.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchFromExternalSource = async () => {
    if (!settings.externalSourceUrl) {
      setError("Inserisci l'URL del tuo generatore nelle impostazioni.");
      setShowSettings(true);
      return;
    }
    setIsFetchingFromSource(true);
    setError(null);
    try {
      const response = await fetch(settings.externalSourceUrl);
      if (!response.ok) throw new Error("Impossibile connettersi al generatore.");
      const data = await response.json();
      const newPosts: PostInput[] = data.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        text: typeof item === 'string' ? item : (item.text || item.copy || ""),
        platform: item.platform || 'instagram'
      }));
      if (newPosts.length > 0) setPostInputs(newPosts);
    } catch (err: any) {
      setError("Errore nel recupero dati: " + err.message);
    } finally {
      setIsFetchingFromSource(false);
    }
  };

  const handleStartBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = postInputs.filter(p => p.text.trim().length > 5);
    if (!valid.length) return setError("Inserisci dei testi validi nella coda.");
    
    setIsProcessingBatch(true);
    setError(null);
    try {
      const results: AdAnalysis[] = [];
      const newPrompts = { ...customPrompts };
      for (const post of valid) {
        const result = await analyzeAdText(post.text, post.platform, settings);
        results.push(result);
        result.concepts.forEach(c => {
          newPrompts[`${c.id}_text`] = c.promptWithText;
          newPrompts[`${c.id}_clean`] = c.promptClean;
        });
      }
      setBatchResults(results);
      setCustomPrompts(newPrompts);
      setActivePostId(results[0].id);
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setIsProcessingBatch(false); 
    }
  };

  const handleGenerateOne = async (concept: VisualConcept, variantOverride?: 'clean' | 'text') => {
    if (generatingIds.has(concept.id)) return;
    const variant = variantOverride || variantToggle[concept.id] || 'text';
    setGeneratingIds(prev => new Set(prev).add(concept.id));
    try {
      const ratioMap: any = { "1:1": "1:1", "4:5": "3:4", "9:16": "9:16" };
      const url = await generateImageConcept(customPrompts[`${concept.id}_${variant}`], ratioMap[concept.recommendedFormat], settings);
      setGeneratedImages(prev => [{ conceptId: concept.id, imageUrl: url, variant, timestamp: Date.now() }, ...prev]);
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setGeneratingIds(prev => { const n = new Set(prev); n.delete(concept.id); return n; }); 
    }
  };

  const handleBatchGenerateFirstImages = async () => {
    if (isBatchRendering || !batchResults.length) return;
    setIsBatchRendering(true);
    try {
      for (const result of batchResults) {
        const firstConcept = result.concepts[0];
        // Controlla se l'immagine è già stata generata
        const alreadyExists = generatedImages.some(img => img.conceptId === firstConcept.id);
        if (!alreadyExists) {
          await handleGenerateOne(firstConcept, 'text');
        }
      }
    } catch (err: any) {
      setError("Errore durante il rendering batch: " + err.message);
    } finally {
      setIsBatchRendering(false);
    }
  };

  const activePost = useMemo(() => batchResults.find(p => p.id === activePostId), [batchResults, activePostId]);
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-[#020617]' : 'bg-[#f8fafc]';
  const cardBg = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm';

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${isDark ? 'text-slate-100' : 'text-slate-900'} font-['Inter'] transition-colors duration-500`}>
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className={`max-w-md w-full p-10 rounded-[3rem] border ${cardBg} shadow-2xl animate-in zoom-in-95`}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-tighter">Advanced Config</h3>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase mb-2 block opacity-50">API Key di Google AI Studio</label>
                <input 
                  type="password" 
                  value={settings.manualApiKey}
                  onChange={e => setSettings({...settings, manualApiKey: e.target.value})}
                  className={`w-full h-12 px-4 rounded-xl border outline-none text-sm ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200'}`}
                  placeholder="Incolla qui la tua API Key..."
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase mb-2 block opacity-50">Endpoint Generatore Testi (JSON)</label>
                <input 
                  type="text" 
                  value={settings.externalSourceUrl}
                  onChange={e => setSettings({...settings, externalSourceUrl: e.target.value})}
                  className={`w-full h-12 px-4 rounded-xl border outline-none text-sm ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200'}`}
                  placeholder="https://progetto.replit.app/api/generatesti"
                />
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">Salva e Chiudi</button>
            </div>
          </div>
        </div>
      )}

      <header className={`h-20 ${isDark ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'} border-b sticky top-0 z-50 flex items-center backdrop-blur-xl`}>
        <div className="max-w-7xl mx-auto px-8 w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-bolt-lightning text-white"></i></div>
            <h1 className="text-lg font-black tracking-tighter">ADVISAGE <span className="text-indigo-500">PRO</span></h1>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setViewMode(viewMode === 'factory' ? 'pitch' : 'factory')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${viewMode === 'pitch' ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg' : isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                {viewMode === 'factory' ? 'Client Pitch Mode' : 'Back to Factory'}
             </button>
             <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                <i className="fas fa-cog"></i>
             </button>
             <button onClick={toggleTheme} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-8 py-12 w-full relative">
        {!batchResults.length ? (
          <div className="flex flex-col lg:flex-row gap-12 items-start animate-in fade-in duration-500">
            <aside className="lg:w-80 shrink-0 space-y-6">
              <div className={`p-8 rounded-[2.5rem] border ${cardBg}`}>
                <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">Factory Styles</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold uppercase opacity-40 mb-2 block">Mood</label>
                    <select value={settings.mood} onChange={e => setSettings({...settings, mood: e.target.value as any})} className={`w-full h-11 rounded-xl text-xs px-3 border outline-none ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white text-slate-800'}`}>
                      <option value="luxury">Luxury / Elegant</option>
                      <option value="energetic">Vibrant / Energetic</option>
                      <option value="professional">Enterprise / Trusted</option>
                      <option value="minimalist">Minimalist / Zen</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase opacity-40 mb-2 block">Art Style</label>
                    <select value={settings.stylePreference} onChange={e => setSettings({...settings, stylePreference: e.target.value as any})} className={`w-full h-11 rounded-xl text-xs px-3 border outline-none ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white text-slate-800'}`}>
                      <option value="realistic">Photography</option>
                      <option value="3d-render">3D Product Render</option>
                      <option value="illustration">Flat Design</option>
                      <option value="cyberpunk">Cyber / Neon</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={fetchFromExternalSource} 
                disabled={isFetchingFromSource}
                className={`w-full py-5 rounded-[2rem] border-2 border-dashed ${isDark ? 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400' : 'border-indigo-200 bg-white text-indigo-600'} text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50`}
              >
                <i className={`fas ${isFetchingFromSource ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-down'}`}></i> 
                Importa da Generatore
              </button>
            </aside>

            <div className="flex-1 space-y-6">
              <div className="flex flex-col gap-4">
                {postInputs.map((post, idx) => (
                  <div key={post.id} className={`p-8 rounded-[2.5rem] border ${cardBg} flex flex-col md:flex-row gap-6 relative group transition-all hover:border-indigo-500/30`}>
                    <div className="md:w-40 shrink-0">
                       <label className="text-[9px] font-black uppercase opacity-40 mb-3 block">Social Platform</label>
                       <select value={post.platform} onChange={e => updatePost(post.id, { platform: e.target.value as any })} className={`w-full h-10 rounded-xl text-[10px] font-black uppercase px-2 border outline-none ${isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50'}`}>
                          <option value="instagram">Instagram</option>
                          <option value="tiktok">TikTok</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="facebook">Facebook</option>
                       </select>
                    </div>
                    <div className="flex-1">
                       <label className="text-[9px] font-black uppercase opacity-40 mb-3 block">Ad Copy Content #{idx+1}</label>
                       <textarea value={post.text} onChange={e => updatePost(post.id, { text: e.target.value })} className="w-full h-32 bg-transparent border-none focus:ring-0 text-sm outline-none resize-none leading-relaxed" placeholder="Scrivi o importa il testo qui..." />
                       {postInputs.length > 1 && (
                         <button onClick={() => removePostInput(post.id)} className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 text-rose-500 transition-all">
                           <i className="fas fa-trash-alt"></i>
                         </button>
                       )}
                    </div>
                  </div>
                ))}
                <div className="flex gap-4">
                   <button onClick={addPostInput} className={`flex-1 py-6 border-2 border-dashed ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all`}>Aggiungi Post</button>
                   <button onClick={handleStartBatch} disabled={isProcessingBatch} className="flex-[2] py-6 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-indigo-500 transition-all disabled:opacity-50">
                      {isProcessingBatch ? <><i className="fas fa-cog fa-spin mr-3"></i> Analisi in corso...</> : 'Inizia Produzione Batch'}
                   </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-10">
            <aside className="lg:w-80 shrink-0">
               <div className={`p-6 rounded-[2.5rem] border ${cardBg} sticky top-28 space-y-3 shadow-xl`}>
                  <h4 className="text-[10px] font-black uppercase opacity-40 px-4 mb-4">Coda Elaborata</h4>
                  <div className="space-y-2 mb-6">
                    {batchResults.map(p => {
                      const firstConceptId = p.concepts[0].id;
                      const hasImage = generatedImages.some(img => img.conceptId === firstConceptId);
                      const isGenerating = generatingIds.has(firstConceptId);
                      
                      return (
                        <button key={p.id} onClick={() => setActivePostId(p.id)} className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${activePostId === p.id ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg' : isDark ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                           <div className="relative">
                             <i className={`fab fa-${p.socialNetwork} text-xs opacity-60`}></i>
                             {hasImage && <div className="absolute -top-2 -right-2 w-2 h-2 bg-emerald-500 rounded-full shadow-lg"></div>}
                             {isGenerating && <div className="absolute -top-2 -right-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>}
                           </div>
                           <div className="truncate">
                             <p className="text-[10px] font-black uppercase truncate">{p.context.sector}</p>
                             <p className="text-[8px] opacity-60 truncate">{p.tone}</p>
                           </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  <button 
                    onClick={handleBatchGenerateFirstImages}
                    disabled={isBatchRendering}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <i className={`fas ${isBatchRendering ? 'fa-spinner fa-spin' : 'fa-layer-group'}`}></i>
                    {isBatchRendering ? 'Rendering in corso...' : 'Renderizza Anteprime Batch'}
                  </button>

                  <div className="pt-4 mt-4 border-t border-white/5">
                    <button onClick={() => { setBatchResults([]); setPostInputs([{ id: 'reset', text: '', platform: 'instagram' }]); }} className="w-full py-3 text-[9px] font-black uppercase tracking-widest text-rose-500">Pulisci Tutto</button>
                  </div>
               </div>
            </aside>

            <div className="flex-1 space-y-12 animate-in slide-in-from-bottom-6 duration-700">
               {activePost && (
                 <>
                   {/* Meta Analysis */}
                   <div className={`p-10 rounded-[3.5rem] border ${cardBg} shadow-2xl relative overflow-hidden group`}>
                      <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:rotate-12 transition-transform pointer-events-none">
                         <i className={`fab fa-${activePost.socialNetwork} text-[15rem]`}></i>
                      </div>
                      <div className="max-w-2xl relative z-10">
                        <h2 className="text-4xl font-black tracking-tighter mb-8">Brand Strategy <span className="text-indigo-500">Report</span></h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                           <div className={`p-6 rounded-3xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                              <p className="text-[9px] font-black uppercase opacity-40 mb-2">Obiettivo Campagna</p>
                              <p className="text-sm font-bold">{activePost.objective}</p>
                           </div>
                           <div className={`p-6 rounded-3xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                              <p className="text-[9px] font-black uppercase opacity-40 mb-2">Assetto Emotivo</p>
                              <p className="text-sm font-bold text-indigo-500">{activePost.emotion}</p>
                           </div>
                        </div>
                        <div className={`p-8 rounded-[2.5rem] border ${isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                           <p className="text-[10px] font-black uppercase text-indigo-500 mb-3 flex items-center gap-2">
                             <i className="fas fa-chess-knight"></i> Competitive Edge
                           </p>
                           <p className="text-sm leading-relaxed opacity-80 italic">"{activePost.competitiveEdge}"</p>
                        </div>
                      </div>
                   </div>

                   {/* Captions Generator */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {activePost.socialCaptions.map((cap, i) => (
                        <div key={i} className={`p-8 rounded-[3rem] border ${cardBg} flex flex-col group hover:scale-[1.02] transition-all`}>
                           <div className="flex justify-between items-center mb-6">
                             <span className="text-[9px] font-black uppercase px-3 py-1 bg-indigo-600 text-white rounded-full">{cap.tone}</span>
                             <button onClick={() => navigator.clipboard.writeText(cap.text)} className="text-slate-500 hover:text-indigo-500"><i className="fas fa-copy"></i></button>
                           </div>
                           <p className="text-xs leading-relaxed mb-8 opacity-70 line-clamp-6">{cap.text}</p>
                           <div className="mt-auto flex flex-wrap gap-2">
                              {cap.hashtags.map(h => <span key={h} className="text-[9px] text-indigo-500 font-black">#{h}</span>)}
                           </div>
                        </div>
                      ))}
                   </div>

                   {/* Concepts Section */}
                   <div className="space-y-16">
                      {activePost.concepts.map(concept => {
                        const isGen = generatingIds.has(concept.id);
                        const variant = variantToggle[concept.id] || 'text';
                        const currentImg = generatedImages.find(i => i.conceptId === concept.id && i.variant === variant)?.imageUrl;
                        
                        return (
                          <div key={concept.id} className={`rounded-[4rem] border overflow-hidden flex flex-col lg:flex-row items-stretch ${cardBg} shadow-2xl hover:border-indigo-500/30 transition-all`}>
                            <div className={`lg:w-[500px] bg-black shrink-0 relative flex items-center justify-center overflow-hidden group/img
                              ${activePost.socialNetwork === 'tiktok' ? 'aspect-[9/16]' : 'aspect-square'}`}>
                               {currentImg ? (
                                 <>
                                   <img src={currentImg} className="w-full h-full object-cover animate-in fade-in duration-1000" />
                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                      <button 
                                        onClick={() => downloadImage(currentImg, `advisage-${concept.title.replace(/\s+/g, '-').toLowerCase()}-${variant}.png`)}
                                        className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                                      >
                                        <i className="fas fa-download text-lg"></i>
                                      </button>
                                   </div>
                                 </>
                               ) : (
                                 <div className="flex flex-col items-center opacity-20">
                                   <i className="fas fa-wand-sparkles text-7xl mb-4"></i>
                                   <p className="text-[10px] font-black uppercase tracking-[0.3em]">Ready for Render</p>
                                 </div>
                               )}
                               {isGen && (
                                 <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-10 backdrop-blur-xl">
                                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                                    <p className="text-[10px] font-black uppercase text-white tracking-[0.5em]">Synthesizing...</p>
                                 </div>
                               )}
                            </div>
                            
                            <div className="flex-1 p-12 flex flex-col">
                               <div className="flex flex-wrap justify-between items-start mb-10 gap-4">
                                  <div className="flex-1">
                                     <h3 className="text-3xl font-black mb-2 tracking-tighter">{concept.title}</h3>
                                     <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">{concept.styleType}</p>
                                  </div>
                                  <div className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase border flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50'}`}>
                                     <i className="fas fa-crop-simple"></i> Ratio {concept.recommendedFormat}
                                  </div>
                               </div>

                               <div className="space-y-6 mb-12">
                                  <p className="text-[13px] leading-relaxed opacity-60 italic">"{concept.description}"</p>
                                  <div className={`p-6 rounded-3xl border ${isDark ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                     <p className="text-[10px] font-black uppercase opacity-40 mb-2">Strategy Reasoning</p>
                                     <p className="text-[11px] leading-relaxed opacity-80">{concept.reasoning}</p>
                                  </div>
                               </div>
                               
                               <div className="mt-auto space-y-6">
                                  <div className={`flex p-2 rounded-3xl border ${isDark ? 'bg-black/60 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                                     <button 
                                      onClick={() => setVariantToggle({...variantToggle, [concept.id]: 'text'})} 
                                      className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 ${variant === 'text' ? 'bg-white text-black shadow-xl scale-[1.02]' : 'opacity-40 hover:opacity-100'}`}
                                     >
                                       <i className="fas fa-font"></i> Con Testo Ad
                                     </button>
                                     <button 
                                      onClick={() => setVariantToggle({...variantToggle, [concept.id]: 'clean'})} 
                                      className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 ${variant === 'clean' ? 'bg-white text-black shadow-xl scale-[1.02]' : 'opacity-40 hover:opacity-100'}`}
                                     >
                                       <i className="fas fa-image"></i> Solo Visual
                                     </button>
                                  </div>
                                  <button 
                                    onClick={() => handleGenerateOne(concept)} 
                                    disabled={isGen}
                                    className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-indigo-500 hover:scale-[1.01] transition-all disabled:opacity-50"
                                  >
                                    Renderizza Asset Pro
                                  </button>
                               </div>
                            </div>
                          </div>
                        );
                      })}
                   </div>
                 </>
               )}
            </div>
          </div>
        )}
      </main>

      {error && (
        <div className="fixed bottom-10 right-10 bg-rose-600 text-white p-6 rounded-[2rem] shadow-2xl z-[100] animate-in slide-in-from-right-10 flex items-center gap-4">
          <i className="fas fa-circle-exclamation"></i>
          <span className="text-xs font-black uppercase">{error}</span>
          <button onClick={() => setError(null)} className="ml-4 opacity-50"><i className="fas fa-times"></i></button>
        </div>
      )}
    </div>
  );
};

export default App;
