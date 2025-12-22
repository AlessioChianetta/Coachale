export const TILE_SIZE = 48;
export const GRID_SIZE = 20;
export const SPRITE_SIZE = 16;

export const TILES = {
  grass: [0, 1, 2, 3],
  road_h: 24,
  road_v: 48,
  road_cross: 72,
  
  house_blue: 168,
  house_red: 171,
  house_green: 174,
  house_yellow: 177,
  
  building_tall: 192,
  building_shop: 195,
  building_office: 198,
  
  tree: 96,
  bush: 99,
  flower: 102,
  
  char_down_1: 480,
  char_down_2: 481,
  char_up_1: 482,
  char_up_2: 483,
  char_left_1: 484,
  char_right_1: 485,
};

export const BUILDING_CONFIGS = [
  {
    id: 'vertex_ai',
    name: 'Torre AI',
    configStep: 'vertex_ai',
    tileIndex: TILES.building_tall,
    icon: '🤖',
    description: 'Configura Vertex AI per il tuo assistente intelligente',
    defaultPosition: { x: 3, y: 3 },
    size: { width: 2, height: 2 },
  },
  {
    id: 'smtp',
    name: 'Ufficio Postale',
    configStep: 'smtp',
    tileIndex: TILES.house_blue,
    icon: '📧',
    description: 'Configura le email SMTP',
    defaultPosition: { x: 8, y: 3 },
    size: { width: 2, height: 2 },
  },
  {
    id: 'calendar',
    name: 'Torre del Tempo',
    configStep: 'google_calendar',
    tileIndex: TILES.building_office,
    icon: '📅',
    description: 'Collega Google Calendar',
    defaultPosition: { x: 13, y: 3 },
    size: { width: 2, height: 2 },
  },
  {
    id: 'whatsapp',
    name: 'Centro Messaggi',
    configStep: 'twilio_config',
    tileIndex: TILES.house_green,
    icon: '💬',
    description: 'Configura WhatsApp Business',
    defaultPosition: { x: 3, y: 8 },
    size: { width: 2, height: 2 },
  },
  {
    id: 'agents',
    name: 'Quartier Generale Agenti',
    configStep: 'inbound_agent',
    tileIndex: TILES.building_shop,
    icon: '🤝',
    description: 'Crea i tuoi agenti AI',
    defaultPosition: { x: 8, y: 8 },
    size: { width: 3, height: 2 },
  },
  {
    id: 'knowledge',
    name: 'Biblioteca',
    configStep: 'knowledge_base',
    tileIndex: TILES.house_red,
    icon: '📚',
    description: 'Carica documenti per la knowledge base',
    defaultPosition: { x: 14, y: 8 },
    size: { width: 2, height: 2 },
  },
  {
    id: 'courses',
    name: 'Accademia',
    configStep: 'first_course',
    tileIndex: TILES.house_yellow,
    icon: '🎓',
    description: 'Crea corsi per i tuoi clienti',
    defaultPosition: { x: 5, y: 13 },
    size: { width: 2, height: 2 },
  },
  {
    id: 'exercises',
    name: 'Palestra',
    configStep: 'first_exercise',
    tileIndex: TILES.building_office,
    icon: '💪',
    description: 'Crea esercizi pratici',
    defaultPosition: { x: 11, y: 13 },
    size: { width: 2, height: 2 },
  },
];

export const NPC_CONFIGS = [
  {
    id: 'professor',
    name: 'Prof. Guida',
    tileIndex: TILES.char_down_1,
    dialogue: [
      'Benvenuto nel Villaggio Coachale!',
      'Qui potrai configurare tutti i tuoi strumenti.',
      'Avvicinati a un edificio e premi SPAZIO per interagire.',
      'Buona esplorazione!',
    ],
    defaultPosition: { x: 10, y: 12 },
  },
];

export function getTilePath(index: number): string {
  const paddedIndex = index.toString().padStart(4, '0');
  return `/game/kenney/Tiles/tile_${paddedIndex}.png`;
}

export function getCharacterTile(direction: 'up' | 'down' | 'left' | 'right', frame: number = 0): number {
  switch (direction) {
    case 'down': return frame === 0 ? TILES.char_down_1 : TILES.char_down_2;
    case 'up': return frame === 0 ? TILES.char_up_1 : TILES.char_up_2;
    case 'left': return TILES.char_left_1;
    case 'right': return TILES.char_right_1;
  }
}
