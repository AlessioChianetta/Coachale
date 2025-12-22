import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
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

    this.load.image('player_sheet', '/game/sprites/pokemon-style_player_sprite_sheet.png');
    this.load.image('buildings_tileset', '/game/sprites/pokemon-style_village_buildings_tileset.png');
    this.load.image('trees_tileset', '/game/sprites/pokemon-style_trees_and_nature_tileset.png');
    this.load.image('fountain_tileset', '/game/sprites/pokemon-style_fountain_plaza_tileset.png');
  }

  create() {
    this.createSpritesFromTilesets();
    this.scene.start('VillageScene');
  }

  createSpritesFromTilesets() {
    const playerTexture = this.textures.get('player_sheet');
    if (playerTexture && playerTexture.key !== '__MISSING') {
      const frame = playerTexture.getSourceImage();
      const size = Math.min(frame.width, frame.height) / 4;
      this.textures.addSpriteSheet('player', playerTexture.getSourceImage(), {
        frameWidth: size,
        frameHeight: size
      });
    } else {
      this.createFallbackPlayer();
    }

    const buildingsTexture = this.textures.get('buildings_tileset');
    if (buildingsTexture && buildingsTexture.key !== '__MISSING') {
      const buildingTypes = ['tower_ai', 'post_office', 'clocktower', 'twilio_central', 
                            'library', 'school', 'cinema', 'portal', 'lead_station', 'agent_house'];
      const frame = buildingsTexture.getSourceImage();
      const cols = 4;
      const tileW = frame.width / cols;
      const tileH = tileW;
      
      buildingTypes.forEach((type, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        this.textures.addSpriteSheetFromAtlas(`building_${type}`, {
          atlas: 'buildings_tileset',
          frame: 'buildings_tileset',
          frameWidth: tileW,
          frameHeight: tileH,
          startFrame: 0,
          endFrame: 0
        });
      });
    }
    
    this.createFallbackBuildings();
    this.createFallbackNature();
  }

  createFallbackPlayer() {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x4a90d9, 1);
    g.fillRoundedRect(4, 0, 24, 28, 4);
    g.fillStyle(0xffd5b5, 1);
    g.fillCircle(16, 8, 8);
    g.fillStyle(0x2d5a87, 1);
    g.fillRect(6, 20, 8, 12);
    g.fillRect(18, 20, 8, 12);
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(13, 6, 2);
    g.fillCircle(19, 6, 2);
    g.fillStyle(0x3d2314, 1);
    g.fillRect(8, -2, 16, 6);
    g.generateTexture('player', 32, 32);
    g.destroy();
  }

  createFallbackBuildings() {
    const buildingConfigs: Record<string, { main: number, roof: number, accent: number }> = {
      tower_ai: { main: 0x7c3aed, roof: 0x4c1d95, accent: 0xfbbf24 },
      post_office: { main: 0xdc2626, roof: 0x7f1d1d, accent: 0xfef3c7 },
      clocktower: { main: 0xd97706, roof: 0x78350f, accent: 0xfef3c7 },
      twilio_central: { main: 0x059669, roof: 0x064e3b, accent: 0xa7f3d0 },
      library: { main: 0x4f46e5, roof: 0x312e81, accent: 0xfef3c7 },
      school: { main: 0xdb2777, roof: 0x831843, accent: 0xfce7f3 },
      cinema: { main: 0x0d9488, roof: 0x134e4a, accent: 0xfbbf24 },
      portal: { main: 0x7c3aed, roof: 0x4c1d95, accent: 0x22d3ee },
      lead_station: { main: 0x0891b2, roof: 0x164e63, accent: 0xa5f3fc },
      agent_house: { main: 0x10b981, roof: 0x064e3b, accent: 0xfbbf24 }
    };

    Object.entries(buildingConfigs).forEach(([key, colors]) => {
      const g = this.make.graphics({ x: 0, y: 0 });
      
      g.fillStyle(0x1e293b, 0.3);
      g.fillEllipse(32, 68, 56, 12);
      
      g.fillStyle(colors.main, 1);
      g.fillRoundedRect(4, 20, 56, 44, 2);
      
      g.fillStyle(colors.roof, 1);
      g.beginPath();
      g.moveTo(0, 24);
      g.lineTo(32, 0);
      g.lineTo(64, 24);
      g.closePath();
      g.fillPath();
      
      g.fillStyle(colors.roof - 0x111111, 1);
      g.beginPath();
      g.moveTo(32, 0);
      g.lineTo(64, 24);
      g.lineTo(32, 24);
      g.closePath();
      g.fillPath();
      
      g.fillStyle(colors.accent, 1);
      g.fillRect(14, 32, 12, 10);
      g.fillRect(38, 32, 12, 10);
      
      g.fillStyle(0x1e293b, 0.5);
      g.fillRect(14, 32, 6, 10);
      g.fillRect(38, 32, 6, 10);
      
      g.fillStyle(0x8b5a2b, 1);
      g.fillRoundedRect(24, 48, 16, 20, 1);
      g.fillStyle(0x5c3d1e, 1);
      g.fillCircle(36, 58, 2);
      
      g.generateTexture(`building_${key}`, 64, 72);
      g.destroy();
    });
  }

  createFallbackNature() {
    const treeG = this.make.graphics({ x: 0, y: 0 });
    
    treeG.fillStyle(0x1e293b, 0.2);
    treeG.fillEllipse(20, 52, 24, 8);
    
    treeG.fillStyle(0x5d4037, 1);
    treeG.fillRect(16, 36, 8, 18);
    
    treeG.fillStyle(0x2d5a2d, 1);
    treeG.fillCircle(20, 24, 18);
    treeG.fillStyle(0x3d7a3d, 1);
    treeG.fillCircle(14, 18, 10);
    treeG.fillCircle(26, 20, 12);
    treeG.fillCircle(20, 12, 8);
    
    treeG.fillStyle(0x4a9a4a, 1);
    treeG.fillCircle(12, 14, 4);
    treeG.fillCircle(24, 10, 3);
    treeG.fillCircle(28, 18, 4);
    
    treeG.generateTexture('tree', 40, 56);
    treeG.destroy();

    const fountainG = this.make.graphics({ x: 0, y: 0 });
    
    fountainG.fillStyle(0x1e293b, 0.2);
    fountainG.fillEllipse(32, 58, 48, 12);
    
    fountainG.fillStyle(0x64748b, 1);
    fountainG.fillEllipse(32, 48, 48, 24);
    fountainG.fillStyle(0x475569, 1);
    fountainG.fillEllipse(32, 48, 44, 20);
    
    fountainG.fillStyle(0x38bdf8, 1);
    fountainG.fillEllipse(32, 46, 36, 16);
    fountainG.fillStyle(0x7dd3fc, 0.6);
    fountainG.fillEllipse(24, 44, 12, 6);
    
    fountainG.fillStyle(0x64748b, 1);
    fountainG.fillRect(28, 20, 8, 28);
    fountainG.fillEllipse(32, 20, 16, 8);
    
    fountainG.fillStyle(0x7dd3fc, 0.8);
    fountainG.fillCircle(26, 14, 3);
    fountainG.fillCircle(32, 10, 4);
    fountainG.fillCircle(38, 14, 3);
    fountainG.fillCircle(32, 6, 2);
    
    fountainG.generateTexture('fountain', 64, 64);
    fountainG.destroy();
    
    const bushG = this.make.graphics({ x: 0, y: 0 });
    bushG.fillStyle(0x1e293b, 0.15);
    bushG.fillEllipse(12, 22, 18, 6);
    bushG.fillStyle(0x2d5a2d, 1);
    bushG.fillCircle(12, 14, 10);
    bushG.fillStyle(0x3d7a3d, 1);
    bushG.fillCircle(8, 12, 6);
    bushG.fillCircle(16, 10, 5);
    bushG.generateTexture('bush', 24, 24);
    bushG.destroy();
    
    const flowerG = this.make.graphics({ x: 0, y: 0 });
    flowerG.fillStyle(0x22c55e, 1);
    flowerG.fillRect(6, 10, 4, 10);
    flowerG.fillStyle(0xfbbf24, 1);
    flowerG.fillCircle(8, 8, 6);
    flowerG.fillStyle(0xfef3c7, 1);
    flowerG.fillCircle(8, 8, 3);
    flowerG.generateTexture('flower', 16, 20);
    flowerG.destroy();
  }
}
