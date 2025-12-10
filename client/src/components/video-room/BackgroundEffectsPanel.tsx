import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Image, Palette, User, Check, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  BLUR_BACKGROUNDS,
  PROFESSIONAL_BACKGROUNDS,
  VIDEO_FILTERS,
  APPEARANCE_OPTIONS,
  type BackgroundOption,
  type FilterOption,
} from '@/lib/backgrounds';

interface BackgroundEffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBackground: string;
  selectedFilter: string;
  appearanceSettings: Record<string, boolean>;
  onBackgroundChange: (background: BackgroundOption) => void;
  onFilterChange: (filter: FilterOption) => void;
  onAppearanceChange: (settingId: string, enabled: boolean) => void;
  previewStream?: MediaStream | null;
}

export default function BackgroundEffectsPanel({
  isOpen,
  onClose,
  selectedBackground,
  selectedFilter,
  appearanceSettings,
  onBackgroundChange,
  onFilterChange,
  onAppearanceChange,
  previewStream,
}: BackgroundEffectsPanelProps) {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [activeTab, setActiveTab] = useState('backgrounds');
  const [isLoadingBackground, setIsLoadingBackground] = useState(false);

  useEffect(() => {
    if (videoPreviewRef.current && previewStream) {
      videoPreviewRef.current.srcObject = previewStream;
    }
  }, [previewStream, isOpen]);

  const handleBackgroundSelect = async (bg: BackgroundOption) => {
    setIsLoadingBackground(true);
    onBackgroundChange(bg);
    setTimeout(() => setIsLoadingBackground(false), 500);
  };

  const selectedFilterObj = VIDEO_FILTERS.find(f => f.id === selectedFilter) || VIDEO_FILTERS[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm"
          >
            <div className="h-full bg-gray-900 shadow-2xl border-l border-gray-700 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Sfondi ed effetti
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-4">
                <div className="aspect-video bg-gray-950 rounded-xl overflow-hidden relative">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                    style={{ 
                      transform: 'scaleX(-1)',
                      filter: selectedFilterObj.css || 'none',
                    }}
                  />
                  {isLoadingBackground && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                  {!previewStream && (
                    <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center">
                      <User className="w-16 h-16 text-gray-600 mb-2" />
                      <p className="text-gray-500 text-sm">
                        La videocamera è disattivata. Se selezioni un effetto, si attiverà nuovamente.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="mx-4 bg-gray-800/50">
                  <TabsTrigger value="backgrounds" className="flex-1 gap-2">
                    <Image className="w-4 h-4" />
                    Sfondi
                  </TabsTrigger>
                  <TabsTrigger value="filters" className="flex-1 gap-2">
                    <Palette className="w-4 h-4" />
                    Filtri
                  </TabsTrigger>
                  <TabsTrigger value="appearance" className="flex-1 gap-2">
                    <User className="w-4 h-4" />
                    Aspetto
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto p-4">
                  <TabsContent value="backgrounds" className="mt-0 space-y-4">
                    <Button
                      variant="outline"
                      className="w-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/30 hover:border-purple-500/50 text-white"
                    >
                      <Sparkles className="w-4 h-4 mr-2 text-purple-400" />
                      Genera uno sfondo (AI)
                    </Button>

                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-3">
                        Sfocatura e sfondi personali
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {BLUR_BACKGROUNDS.map(bg => (
                          <button
                            key={bg.id}
                            onClick={() => handleBackgroundSelect(bg)}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              selectedBackground === bg.id
                                ? 'border-blue-500 ring-2 ring-blue-500/30'
                                : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <div className={`w-full h-full flex items-center justify-center ${
                              bg.type === 'none' ? 'bg-gray-800' : 'bg-gradient-to-br from-blue-600 to-blue-800'
                            }`}>
                              {bg.type === 'none' ? (
                                <User className="w-6 h-6 text-gray-500" />
                              ) : (
                                <div 
                                  className="w-full h-full flex items-center justify-center"
                                  style={{ backdropFilter: `blur(${bg.intensity}px)` }}
                                >
                                  <User className="w-6 h-6 text-white/80" />
                                </div>
                              )}
                            </div>
                            {selectedBackground === bg.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                                <Check className="w-5 h-5 text-blue-400" />
                              </div>
                            )}
                          </button>
                        ))}
                        <button className="aspect-square rounded-lg border-2 border-dashed border-gray-600 hover:border-gray-500 flex items-center justify-center transition-colors">
                          <Upload className="w-5 h-5 text-gray-500" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-3">
                        Professionali
                      </h3>
                      <div className="grid grid-cols-4 gap-2">
                        {PROFESSIONAL_BACKGROUNDS.map(bg => (
                          <button
                            key={bg.id}
                            onClick={() => handleBackgroundSelect(bg)}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all relative ${
                              selectedBackground === bg.id
                                ? 'border-blue-500 ring-2 ring-blue-500/30'
                                : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <img
                              src={bg.thumbnail}
                              alt={bg.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {selectedBackground === bg.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-blue-500/30">
                                <Check className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="filters" className="mt-0">
                    <div className="grid grid-cols-4 gap-2">
                      {VIDEO_FILTERS.map(filter => (
                        <button
                          key={filter.id}
                          onClick={() => onFilterChange(filter)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 transition-all relative ${
                            selectedFilter === filter.id
                              ? 'border-blue-500 ring-2 ring-blue-500/30'
                              : 'border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          <div 
                            className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500"
                            style={{ filter: filter.css || 'none' }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 px-1">
                            <span className="text-[10px] text-white truncate block text-center">
                              {filter.name}
                            </span>
                          </div>
                          {selectedFilter === filter.id && (
                            <div className="absolute top-1 right-1">
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="appearance" className="mt-0 space-y-4">
                    <p className="text-sm text-gray-400">
                      Migliora il tuo aspetto in video con queste opzioni.
                    </p>
                    {APPEARANCE_OPTIONS.map(option => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700"
                      >
                        <div>
                          <Label className="text-white font-medium">{option.name}</Label>
                          <p className="text-xs text-gray-500">{option.description}</p>
                        </div>
                        <Switch
                          checked={appearanceSettings[option.id] || false}
                          onCheckedChange={(checked) => onAppearanceChange(option.id, checked)}
                        />
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 italic">
                      * Alcune funzionalità richiedono l'elaborazione avanzata e potrebbero influire sulle prestazioni.
                    </p>
                  </TabsContent>
                </div>
              </Tabs>

              <div className="p-4 border-t border-gray-700">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={onClose}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Applica effetti
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
