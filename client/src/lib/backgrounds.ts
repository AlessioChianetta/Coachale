export type BackgroundType = 'none' | 'blur' | 'image';

export interface BackgroundOption {
  id: string;
  name: string;
  type: BackgroundType;
  url?: string;
  intensity?: number;
  thumbnail?: string;
}

export interface FilterOption {
  id: string;
  name: string;
  css: string;
}

export interface AppearanceOption {
  id: string;
  name: string;
  description: string;
}

export const BLUR_BACKGROUNDS: BackgroundOption[] = [
  { id: 'none', name: 'Nessuno', type: 'none' },
  { id: 'blur-light', name: 'Sfocatura Leggera', type: 'blur', intensity: 5 },
  { id: 'blur-medium', name: 'Sfocatura Media', type: 'blur', intensity: 10 },
  { id: 'blur-heavy', name: 'Sfocatura Intensa', type: 'blur', intensity: 20 },
];

export const PROFESSIONAL_BACKGROUNDS: BackgroundOption[] = [
  {
    id: 'office-modern',
    name: 'Ufficio Moderno',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&q=60',
  },
  {
    id: 'bookshelf',
    name: 'Libreria',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=200&q=60',
  },
  {
    id: 'plants-office',
    name: 'Ufficio con Piante',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1545165375-1b744b9ed444?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1545165375-1b744b9ed444?w=200&q=60',
  },
  {
    id: 'living-room',
    name: 'Soggiorno',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=200&q=60',
  },
  {
    id: 'cafe',
    name: 'Caffetteria',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&q=60',
  },
  {
    id: 'minimal-white',
    name: 'Minimal Bianco',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=200&q=60',
  },
  {
    id: 'nature-window',
    name: 'Finestra sulla Natura',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1518012312832-96aea3c91144?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1518012312832-96aea3c91144?w=200&q=60',
  },
  {
    id: 'modern-kitchen',
    name: 'Cucina Moderna',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&q=60',
  },
  {
    id: 'coworking',
    name: 'Coworking Space',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&q=60',
  },
  {
    id: 'gradient-blue',
    name: 'Gradiente Blu',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=200&q=60',
  },
  {
    id: 'beach',
    name: 'Spiaggia',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&q=60',
  },
  {
    id: 'mountains',
    name: 'Montagne',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200&q=60',
  },
];

export const VIDEO_FILTERS: FilterOption[] = [
  { id: 'none', name: 'Nessuno', css: '' },
  { id: 'warm', name: 'Caldo', css: 'sepia(15%) saturate(115%) brightness(105%)' },
  { id: 'cool', name: 'Freddo', css: 'saturate(90%) hue-rotate(10deg) brightness(102%)' },
  { id: 'bright', name: 'Luminoso', css: 'brightness(115%) contrast(105%)' },
  { id: 'soft', name: 'Morbido', css: 'brightness(105%) contrast(95%) saturate(90%)' },
  { id: 'cinematic', name: 'Cinematico', css: 'contrast(110%) saturate(85%) brightness(95%)' },
  { id: 'vivid', name: 'Vivido', css: 'saturate(130%) contrast(105%)' },
  { id: 'bw', name: 'Bianco e Nero', css: 'grayscale(100%)' },
];

export const APPEARANCE_OPTIONS: AppearanceOption[] = [
  { id: 'smooth-skin', name: 'Pelle Liscia', description: 'Ammorbidisce le imperfezioni della pelle' },
  { id: 'eye-enhance', name: 'Migliora Occhi', description: 'Illumina e definisce gli occhi' },
  { id: 'auto-light', name: 'Luce Automatica', description: 'Regola automaticamente l\'illuminazione del viso' },
  { id: 'face-retouch', name: 'Ritocco Viso', description: 'Leggero ritocco automatico del viso' },
];

export function getAllBackgrounds(): BackgroundOption[] {
  return [...BLUR_BACKGROUNDS, ...PROFESSIONAL_BACKGROUNDS];
}
