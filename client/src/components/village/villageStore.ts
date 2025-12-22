import { create } from 'zustand';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

export interface Building {
  id: string;
  name: string;
  position: Position;
  size: { width: number; height: number };
  tileIndex: number;
  configStep: string;
  isCompleted: boolean;
  description: string;
  icon: string;
}

export interface NPC {
  id: string;
  name: string;
  position: Position;
  direction: Direction;
  dialogue: string[];
  tileIndex: number;
}

interface VillageState {
  playerPosition: Position;
  playerDirection: Direction;
  isMoving: boolean;
  buildings: Building[];
  npcs: NPC[];
  activeInteraction: string | null;
  dialogueOpen: boolean;
  currentDialogue: string[];
  dialogueIndex: number;
  completedSteps: Set<string>;
  
  movePlayer: (direction: Direction) => void;
  setPlayerPosition: (pos: Position) => void;
  setBuildings: (buildings: Building[]) => void;
  setNPCs: (npcs: NPC[]) => void;
  openInteraction: (buildingId: string) => void;
  closeInteraction: () => void;
  openDialogue: (dialogue: string[]) => void;
  advanceDialogue: () => void;
  closeDialogue: () => void;
  markStepComplete: (stepId: string) => void;
  setCompletedSteps: (steps: string[]) => void;
}

const GRID_SIZE = 20;

const isWalkable = (x: number, y: number, buildings: Building[]): boolean => {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
  
  for (const building of buildings) {
    const bx = building.position.x;
    const by = building.position.y;
    const bw = building.size.width;
    const bh = building.size.height;
    
    if (x >= bx && x < bx + bw && y >= by && y < by + bh) {
      return false;
    }
  }
  
  return true;
};

export const useVillageStore = create<VillageState>((set, get) => ({
  playerPosition: { x: 10, y: 15 },
  playerDirection: 'down',
  isMoving: false,
  buildings: [],
  npcs: [],
  activeInteraction: null,
  dialogueOpen: false,
  currentDialogue: [],
  dialogueIndex: 0,
  completedSteps: new Set(),

  movePlayer: (direction: Direction) => {
    const state = get();
    if (state.isMoving || state.dialogueOpen) return;

    const { x, y } = state.playerPosition;
    let newX = x;
    let newY = y;

    switch (direction) {
      case 'up': newY = y - 1; break;
      case 'down': newY = y + 1; break;
      case 'left': newX = x - 1; break;
      case 'right': newX = x + 1; break;
    }

    set({ playerDirection: direction });

    if (isWalkable(newX, newY, state.buildings)) {
      set({ isMoving: true });
      setTimeout(() => {
        set({ playerPosition: { x: newX, y: newY }, isMoving: false });
      }, 150);
    }
  },

  setPlayerPosition: (pos: Position) => set({ playerPosition: pos }),
  
  setBuildings: (buildings: Building[]) => set({ buildings }),
  
  setNPCs: (npcs: NPC[]) => set({ npcs }),

  openInteraction: (buildingId: string) => set({ activeInteraction: buildingId }),
  
  closeInteraction: () => set({ activeInteraction: null }),

  openDialogue: (dialogue: string[]) => set({ 
    dialogueOpen: true, 
    currentDialogue: dialogue, 
    dialogueIndex: 0 
  }),

  advanceDialogue: () => {
    const state = get();
    if (state.dialogueIndex < state.currentDialogue.length - 1) {
      set({ dialogueIndex: state.dialogueIndex + 1 });
    } else {
      set({ dialogueOpen: false, currentDialogue: [], dialogueIndex: 0 });
    }
  },

  closeDialogue: () => set({ 
    dialogueOpen: false, 
    currentDialogue: [], 
    dialogueIndex: 0 
  }),

  markStepComplete: (stepId: string) => {
    const state = get();
    const newCompleted = new Set(state.completedSteps);
    newCompleted.add(stepId);
    set({ completedSteps: newCompleted });
  },

  setCompletedSteps: (steps: string[]) => set({ completedSteps: new Set(steps) }),
}));
