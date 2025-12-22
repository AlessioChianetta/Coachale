import { useEffect, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVillageStore, type Building, type Direction } from './villageStore';
import { 
  TILE_SIZE, 
  GRID_SIZE, 
  TILES, 
  BUILDING_CONFIGS, 
  NPC_CONFIGS,
  getTilePath,
  getCharacterTile 
} from './tileConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface CoachaleVillageProps {
  configStatus?: Record<string, boolean>;
  onBuildingClick?: (stepId: string) => void;
  onClose?: () => void;
}

const Tile = ({ 
  tileIndex, 
  className = '',
  style = {}
}: { 
  tileIndex: number; 
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`bg-cover bg-center ${className}`}
    style={{
      width: TILE_SIZE,
      height: TILE_SIZE,
      backgroundImage: `url(${getTilePath(tileIndex)})`,
      backgroundSize: 'cover',
      imageRendering: 'pixelated',
      ...style,
    }}
  />
);

const GrassTile = ({ x, y }: { x: number; y: number }) => {
  const tileIndex = TILES.grass[(x + y) % TILES.grass.length];
  return <Tile tileIndex={tileIndex} />;
};

const BuildingTile = ({ 
  building, 
  isCompleted,
  isNearPlayer,
}: { 
  building: Building;
  isCompleted: boolean;
  isNearPlayer: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        left: building.position.x * TILE_SIZE,
        top: building.position.y * TILE_SIZE,
        width: building.size.width * TILE_SIZE,
        height: building.size.height * TILE_SIZE,
        zIndex: building.position.y + 10,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      animate={isNearPlayer ? { 
        boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0)', '0 0 20px 10px rgba(16, 185, 129, 0.3)', '0 0 0 0 rgba(16, 185, 129, 0)']
      } : {}}
      transition={isNearPlayer ? { duration: 1.5, repeat: Infinity } : {}}
    >
      <div 
        className="w-full h-full relative"
        style={{
          backgroundImage: `url(${getTilePath(building.tileIndex)})`,
          backgroundSize: 'cover',
          imageRendering: 'pixelated',
          filter: isCompleted ? 'none' : 'grayscale(50%)',
        }}
      >
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-2xl">
          {building.icon}
        </div>
        
        {isCompleted && (
          <motion.div 
            className="absolute -top-3 -right-3 bg-green-500 rounded-full p-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
          </motion.div>
        )}
        
        {(isHovered || isNearPlayer) && (
          <motion.div
            className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-slate-900/90 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap z-50"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {building.name}
            {isNearPlayer && <span className="ml-2 text-emerald-400">[SPAZIO]</span>}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

const Player = ({ 
  position, 
  direction,
  isMoving 
}: { 
  position: { x: number; y: number };
  direction: Direction;
  isMoving: boolean;
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (isMoving) {
      const interval = setInterval(() => {
        setFrame(f => (f + 1) % 2);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isMoving]);

  const tileIndex = getCharacterTile(direction, frame);

  return (
    <motion.div
      className="absolute z-50"
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
      }}
      animate={{
        left: position.x * TILE_SIZE,
        top: position.y * TILE_SIZE,
      }}
      transition={{
        type: 'tween',
        duration: 0.15,
        ease: 'linear',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url(${getTilePath(tileIndex)})`,
          backgroundSize: 'cover',
          imageRendering: 'pixelated',
        }}
      />
      <motion.div
        className="absolute -bottom-1 left-1/2 w-8 h-2 bg-black/20 rounded-full"
        style={{ transform: 'translateX(-50%)' }}
        animate={{ scale: isMoving ? [1, 0.8, 1] : 1 }}
        transition={{ duration: 0.15, repeat: isMoving ? Infinity : 0 }}
      />
    </motion.div>
  );
};

const NPC = ({ 
  npc,
  onClick 
}: { 
  npc: typeof NPC_CONFIGS[0] & { position: { x: number; y: number } };
  onClick: () => void;
}) => (
  <motion.div
    className="absolute cursor-pointer"
    style={{
      left: npc.position.x * TILE_SIZE,
      top: npc.position.y * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      zIndex: npc.position.y + 10,
    }}
    onClick={onClick}
    animate={{ y: [0, -3, 0] }}
    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
  >
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundImage: `url(${getTilePath(npc.tileIndex)})`,
        backgroundSize: 'cover',
        imageRendering: 'pixelated',
      }}
    />
    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs bg-white/90 px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
      {npc.name}
    </div>
  </motion.div>
);

const DialogueBox = ({ 
  text, 
  speakerName,
  onAdvance 
}: { 
  text: string;
  speakerName: string;
  onAdvance: () => void;
}) => (
  <motion.div
    className="absolute bottom-4 left-4 right-4 bg-slate-900/95 border-2 border-white rounded-lg p-4 z-[100]"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    onClick={onAdvance}
  >
    <div className="text-emerald-400 text-sm font-bold mb-1">{speakerName}</div>
    <motion.div 
      className="text-white text-base"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      key={text}
    >
      {text}
    </motion.div>
    <div className="text-gray-400 text-xs mt-2 text-right animate-pulse">
      Premi SPAZIO per continuare...
    </div>
  </motion.div>
);

export function CoachaleVillage({ 
  configStatus = {}, 
  onBuildingClick,
  onClose 
}: CoachaleVillageProps) {
  const [, setLocation] = useLocation();
  const {
    playerPosition,
    playerDirection,
    isMoving,
    buildings,
    dialogueOpen,
    currentDialogue,
    dialogueIndex,
    activeInteraction,
    setBuildings,
    movePlayer,
    openDialogue,
    advanceDialogue,
    closeDialogue,
    openInteraction,
    closeInteraction,
  } = useVillageStore();

  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  useEffect(() => {
    const mappedBuildings: Building[] = BUILDING_CONFIGS.map(config => ({
      id: config.id,
      name: config.name,
      position: config.defaultPosition,
      size: config.size,
      tileIndex: config.tileIndex,
      configStep: config.configStep,
      isCompleted: configStatus[config.configStep] || false,
      description: config.description,
      icon: config.icon,
    }));
    setBuildings(mappedBuildings);
  }, [configStatus, setBuildings]);

  const nearbyBuilding = useMemo(() => {
    const { x, y } = playerPosition;
    for (const building of buildings) {
      const bx = building.position.x;
      const by = building.position.y;
      const bw = building.size.width;
      const bh = building.size.height;
      
      const isAdjacent = (
        (x >= bx - 1 && x <= bx + bw && y === by + bh) ||
        (x >= bx - 1 && x <= bx + bw && y === by - 1) ||
        (y >= by - 1 && y <= by + bh && x === bx - 1) ||
        (y >= by - 1 && y <= by + bh && x === bx + bw)
      );
      
      if (isAdjacent) return building;
    }
    return null;
  }, [playerPosition, buildings]);

  const nearbyNPC = useMemo(() => {
    const { x, y } = playerPosition;
    for (const npc of NPC_CONFIGS) {
      const nx = npc.defaultPosition.x;
      const ny = npc.defaultPosition.y;
      if (Math.abs(x - nx) <= 1 && Math.abs(y - ny) <= 1) {
        return npc;
      }
    }
    return null;
  }, [playerPosition]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (dialogueOpen) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advanceDialogue();
      }
      return;
    }

    if (activeInteraction) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        movePlayer('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        movePlayer('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        movePlayer('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        movePlayer('right');
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        if (nearbyBuilding) {
          setSelectedBuilding(nearbyBuilding);
          openInteraction(nearbyBuilding.id);
        } else if (nearbyNPC) {
          openDialogue(nearbyNPC.dialogue);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (onClose) onClose();
        break;
    }
  }, [dialogueOpen, activeInteraction, nearbyBuilding, nearbyNPC, movePlayer, advanceDialogue, openDialogue, openInteraction, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleBuildingAction = (building: Building) => {
    closeInteraction();
    setSelectedBuilding(null);
    if (onBuildingClick) {
      onBuildingClick(building.configStep);
    }
  };

  const gridWidth = GRID_SIZE * TILE_SIZE;
  const gridHeight = GRID_SIZE * TILE_SIZE;

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center">
      <div 
        className="relative border-4 border-slate-700 rounded-lg shadow-2xl overflow-hidden"
        style={{ 
          width: gridWidth, 
          height: gridHeight,
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        <div 
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`,
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            return <GrassTile key={`${x}-${y}`} x={x} y={y} />;
          })}
        </div>

        {buildings.map(building => (
          <BuildingTile
            key={building.id}
            building={building}
            isCompleted={building.isCompleted}
            isNearPlayer={nearbyBuilding?.id === building.id}
          />
        ))}

        {NPC_CONFIGS.map(npc => (
          <NPC
            key={npc.id}
            npc={{ ...npc, position: npc.defaultPosition }}
            onClick={() => openDialogue(npc.dialogue)}
          />
        ))}

        <Player
          position={playerPosition}
          direction={playerDirection}
          isMoving={isMoving}
        />

        <AnimatePresence>
          {dialogueOpen && currentDialogue.length > 0 && (
            <DialogueBox
              text={currentDialogue[dialogueIndex]}
              speakerName={nearbyNPC?.name || 'Prof. Guida'}
              onAdvance={advanceDialogue}
            />
          )}
        </AnimatePresence>

        <div className="absolute top-3 left-3 bg-slate-900/80 px-3 py-2 rounded-lg z-50">
          <div className="text-white text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Villaggio Coachale</span>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 bg-slate-900/80 px-3 py-2 rounded-lg z-50">
          <div className="text-gray-400 text-xs space-y-1">
            <div>↑↓←→ o WASD: Muovi</div>
            <div>SPAZIO: Interagisci</div>
            <div>ESC: Esci</div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedBuilding} onOpenChange={() => { setSelectedBuilding(null); closeInteraction(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedBuilding?.icon}</span>
              {selectedBuilding?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedBuilding?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 mt-4">
            {selectedBuilding?.isCompleted ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800 self-start">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Configurato
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 self-start">
                Da configurare
              </Badge>
            )}
            
            <Button 
              onClick={() => selectedBuilding && handleBuildingAction(selectedBuilding)}
              className="w-full"
            >
              {selectedBuilding?.isCompleted ? 'Visualizza Configurazione' : 'Configura Ora'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CoachaleVillage;
