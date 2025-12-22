import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Caricamento Villaggio...', {
      font: '20px Arial',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4ade80, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder graphics (will be replaced with real sprites later)
    this.createPlaceholderGraphics();
  }

  createPlaceholderGraphics() {
    // Create player sprite (simple colored rectangle for now)
    const playerGraphics = this.make.graphics({ x: 0, y: 0 });
    playerGraphics.fillStyle(0x3b82f6, 1);
    playerGraphics.fillRect(0, 0, 32, 32);
    playerGraphics.generateTexture('player', 32, 32);
    playerGraphics.destroy();

    // Create building sprites
    const buildingColors: Record<string, number> = {
      tower_ai: 0x8b5cf6,
      post_office: 0xef4444,
      clocktower: 0xf59e0b,
      twilio_central: 0x22c55e,
      library: 0x6366f1,
      school: 0xec4899,
      cinema: 0x14b8a6,
      portal: 0x8b5cf6,
      lead_station: 0x06b6d4,
      agent_house: 0x10b981
    };

    Object.entries(buildingColors).forEach(([key, color]) => {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(color, 1);
      g.fillRect(0, 0, 64, 64);
      // Add roof
      g.fillStyle(0x1e293b, 1);
      g.fillTriangle(32, -10, 0, 15, 64, 15);
      g.generateTexture(`building_${key}`, 64, 74);
      g.destroy();
    });

    // Create tree sprite
    const treeGraphics = this.make.graphics({ x: 0, y: 0 });
    treeGraphics.fillStyle(0x166534, 1);
    treeGraphics.fillCircle(16, 12, 16);
    treeGraphics.fillStyle(0x854d0e, 1);
    treeGraphics.fillRect(12, 24, 8, 16);
    treeGraphics.generateTexture('tree', 32, 40);
    treeGraphics.destroy();

    // Create fountain sprite
    const fountainGraphics = this.make.graphics({ x: 0, y: 0 });
    fountainGraphics.fillStyle(0x64748b, 1);
    fountainGraphics.fillCircle(24, 24, 24);
    fountainGraphics.fillStyle(0x38bdf8, 1);
    fountainGraphics.fillCircle(24, 24, 18);
    fountainGraphics.generateTexture('fountain', 48, 48);
    fountainGraphics.destroy();
  }

  create() {
    this.scene.start('VillageScene');
  }
}
