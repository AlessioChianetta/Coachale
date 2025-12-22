import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { VillageScene } from './scenes/VillageScene';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';

interface VillageProgress {
  id?: string;
  consultantId?: string;
  positionX: number;
  positionY: number;
  visitedBuildings: string[];
  completedBuildings: string[];
  unlockedAreas: string[];
  badges: string[];
  introCompleted: boolean;
  preferClassicMode: boolean;
}

interface Agent {
  id: string;
  name: string;
  agentType: string;
  isActive: boolean;
}

interface PhaserGameProps {
  onSwitchToClassic: () => void;
}

export function PhaserGame({ onSwitchToClassic }: PhaserGameProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch village progress
  const { data: progress } = useQuery<VillageProgress>({
    queryKey: ['/api/village/progress'],
  });

  // Fetch config status
  const { data: configStatus } = useQuery<Record<string, boolean>>({
    queryKey: ['/api/village/config-status'],
  });

  // Fetch agents
  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['/api/whatsapp/agents'],
  });

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: async (progressData: Partial<VillageProgress>) => {
      const response = await fetch('/api/village/progress', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(progressData)
      });
      if (!response.ok) throw new Error('Failed to save progress');
      return response.json();
    }
  });

  // Handle building clicks
  const handleBuildingClick = useCallback((buildingKey: string, configKey: string) => {
    const configRoutes: Record<string, string> = {
      vertex_ai: '/consultant/admin-settings?tab=ai',
      smtp: '/consultant/admin-settings?tab=email',
      google_calendar: '/consultant/admin-settings?tab=calendar',
      whatsapp_twilio: '/consultant/admin-settings?tab=whatsapp',
      knowledge_base: '/consultant/knowledge-base',
      courses: '/consultant/courses',
      video_meeting: '/consultant/admin-settings?tab=video',
      public_link: '/consultant/whatsapp?tab=agents',
      lead_import: '/consultant/admin-settings?tab=integrations',
      agent_config: '/consultant/whatsapp?tab=agents',
      agent_calendar: '/consultant/whatsapp?tab=agents',
      create_agent: '/consultant/whatsapp?tab=agents'
    };

    const route = configRoutes[configKey];
    if (route) {
      // Save current position before navigating
      if (gameRef.current) {
        const scene = gameRef.current.scene.getScene('VillageScene') as VillageScene;
        if (scene) {
          scene.saveProgress();
        }
      }
      setLocation(route);
    }
  }, [setLocation]);

  // Initialize Phaser game
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 800,
      height: 600,
      backgroundColor: '#1e293b',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [BootScene, VillageScene]
    };

    gameRef.current = new Phaser.Game(config);

    // Listen for save events
    gameRef.current.events.on('saveProgress', (progressData: VillageProgress) => {
      saveProgressMutation.mutate(progressData);
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Pass data to scene when loaded
  useEffect(() => {
    if (!gameRef.current) return;

    const checkScene = () => {
      const scene = gameRef.current?.scene.getScene('VillageScene');
      if (scene && scene.scene.isActive()) {
        // Scene is ready, update it
        (scene as VillageScene).updateConfigStatus(configStatus || {});
      }
    };

    // Check periodically until scene is ready
    const interval = setInterval(checkScene, 100);
    setTimeout(() => clearInterval(interval), 5000);

    return () => clearInterval(interval);
  }, [configStatus]);

  // Start village scene with data
  useEffect(() => {
    if (!gameRef.current || !progress) return;

    const bootScene = gameRef.current.scene.getScene('BootScene');
    if (bootScene && bootScene.scene.isActive()) {
      // Wait for boot to complete, then start village with data
      gameRef.current.events.once('villageReady', () => {
        const villageScene = gameRef.current?.scene.getScene('VillageScene') as VillageScene;
        if (villageScene) {
          villageScene.scene.restart({
            progress,
            configStatus: configStatus || {},
            agents: agents || [],
            onBuildingClick: handleBuildingClick
          });
        }
      });
    }
  }, [progress, configStatus, agents, handleBuildingClick]);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏘️</span>
          <div>
            <h1 className="text-lg font-bold text-white">Coachale Village</h1>
            <p className="text-xs text-slate-400">Esplora e configura la tua piattaforma</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSwitchToClassic}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            📋 Modalità Classica
          </button>
        </div>
      </div>

      {/* Game container */}
      <div className="flex-1 flex items-center justify-center bg-slate-800 p-4">
        <div 
          ref={containerRef} 
          className="rounded-xl overflow-hidden shadow-2xl border-4 border-slate-600"
          style={{ width: 800, height: 600 }}
        />
      </div>

      {/* Controls hint */}
      <div className="p-3 bg-slate-900 border-t border-slate-700">
        <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
          <span>🎮 <strong>WASD</strong> o <strong>Frecce</strong> per muoverti</span>
          <span>🖱️ <strong>Click</strong> su un edificio per interagire</span>
          <span>💾 Posizione salvata automaticamente</span>
        </div>
      </div>
    </div>
  );
}
