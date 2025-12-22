import Phaser from 'phaser';
import { GAME_CONFIG, NPC_DIALOGS } from '../config/gameConfig';

interface VillageProgress {
  positionX: number;
  positionY: number;
  visitedBuildings: string[];
  completedBuildings: string[];
  unlockedAreas: string[];
  badges: string[];
  introCompleted: boolean;
}

interface Agent {
  id: string;
  name: string;
  agentType: string;
  isActive: boolean;
}

export class VillageScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private buildings: Map<string, Phaser.GameObjects.Container> = new Map();
  private agentHouses: Map<string, Phaser.GameObjects.Container> = new Map();
  private dialogBox: Phaser.GameObjects.Container | null = null;
  private progress: VillageProgress | null = null;
  private configStatus: Record<string, boolean> = {};
  private agents: Agent[] = [];
  private saveTimer: number = 0;
  private onBuildingClick?: (buildingKey: string, configKey: string) => void;
  private onDialogOpen?: (npcName: string, message: string, buildingKey: string) => void;

  constructor() {
    super({ key: 'VillageScene' });
  }

  init(data: { 
    progress?: VillageProgress; 
    configStatus?: Record<string, boolean>;
    agents?: Agent[];
    onBuildingClick?: (buildingKey: string, configKey: string) => void;
    onDialogOpen?: (npcName: string, message: string, buildingKey: string) => void;
  }) {
    this.progress = data.progress || null;
    this.configStatus = data.configStatus || {};
    this.agents = data.agents || [];
    this.onBuildingClick = data.onBuildingClick;
    this.onDialogOpen = data.onDialogOpen;
  }

  create() {
    // Create ground
    this.add.rectangle(400, 300, 800, 600, GAME_CONFIG.colors.ground);
    
    // Create paths
    this.createPaths();
    
    // Create fountain in center
    const fountain = this.add.sprite(400, 300, 'fountain');
    fountain.setDepth(1);
    
    // Create decorative trees
    this.createTrees();
    
    // Create buildings
    this.createBuildings();
    
    // Create dynamic agent houses
    this.createAgentHouses();
    
    // Create player
    const startX = this.progress?.positionX || GAME_CONFIG.player.startX;
    const startY = this.progress?.positionY || GAME_CONFIG.player.startY;
    this.player = this.add.sprite(startX, startY, 'player');
    this.player.setDepth(10);
    
    // Setup controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      };
    }

    // Click to move
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.dialogBox) {
        this.movePlayerTo(pointer.worldX, pointer.worldY);
      }
    });

    // Show intro if first time
    if (this.progress && !this.progress.introCompleted) {
      this.showIntro();
    }

    // Add UI elements
    this.createUI();
  }

  createPaths() {
    const pathGraphics = this.add.graphics();
    pathGraphics.fillStyle(GAME_CONFIG.colors.path, 1);
    
    // Horizontal main path
    pathGraphics.fillRect(50, 280, 700, 40);
    
    // Vertical paths
    pathGraphics.fillRect(380, 100, 40, 400);
    pathGraphics.fillRect(130, 200, 40, 200);
    pathGraphics.fillRect(630, 200, 40, 200);
  }

  createTrees() {
    const treePositions = [
      { x: 50, y: 80 }, { x: 750, y: 80 },
      { x: 50, y: 520 }, { x: 750, y: 520 },
      { x: 250, y: 150 }, { x: 550, y: 150 },
      { x: 200, y: 450 }, { x: 600, y: 450 }
    ];
    
    treePositions.forEach(pos => {
      const tree = this.add.sprite(pos.x, pos.y, 'tree');
      tree.setDepth(2);
    });
  }

  createBuildings() {
    Object.entries(GAME_CONFIG.buildings).forEach(([key, config]) => {
      const container = this.add.container(config.x, config.y);
      
      // Building sprite
      const building = this.add.sprite(0, 0, `building_${key}`);
      
      // Determine building state
      const isConfigured = this.configStatus[config.configKey] || false;
      const isCompleted = this.progress?.completedBuildings.includes(key) || false;
      
      if (!isConfigured) {
        building.setTint(GAME_CONFIG.colors.locked);
      } else if (isCompleted) {
        building.setTint(GAME_CONFIG.colors.verified);
      }
      
      // Building label
      const label = this.add.text(0, 45, config.icon + ' ' + config.name, {
        font: '12px Arial',
        color: '#ffffff',
        backgroundColor: '#1e293b',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5);
      
      container.add([building, label]);
      container.setSize(64, 64);
      container.setInteractive();
      container.setDepth(3);
      
      // Click handler
      container.on('pointerdown', () => {
        this.handleBuildingClick(key, config);
      });
      
      // Hover effects
      container.on('pointerover', () => {
        building.setScale(1.1);
        this.input.setDefaultCursor('pointer');
      });
      
      container.on('pointerout', () => {
        building.setScale(1);
        this.input.setDefaultCursor('default');
      });
      
      this.buildings.set(key, container);
    });
  }

  createAgentHouses() {
    const { startX, startY, spacing } = GAME_CONFIG.agentQuarter;
    
    this.agents.forEach((agent, index) => {
      const x = startX + (index * spacing);
      const y = startY;
      
      const container = this.add.container(x, y);
      
      const house = this.add.sprite(0, 0, 'building_agent_house');
      if (agent.isActive) {
        house.setTint(GAME_CONFIG.colors.unlocked);
      } else {
        house.setTint(GAME_CONFIG.colors.locked);
      }
      
      // Agent type icon
      const typeIcon = agent.agentType === 'inbound' ? '📥' : 
                       agent.agentType === 'outbound' ? '📤' : '💼';
      
      const label = this.add.text(0, 45, typeIcon + ' ' + (agent.name || 'Agente'), {
        font: '10px Arial',
        color: '#ffffff',
        backgroundColor: '#1e293b',
        padding: { x: 2, y: 1 }
      }).setOrigin(0.5);
      
      // Calendar icon
      const calendarIcon = this.add.text(0, 60, '🗓️', {
        font: '14px Arial'
      }).setOrigin(0.5).setInteractive();
      
      calendarIcon.on('pointerdown', (e: Phaser.Input.Pointer) => {
        e.stopPropagation();
        this.onBuildingClick?.(`agent_calendar_${agent.id}`, 'agent_calendar');
      });
      
      container.add([house, label, calendarIcon]);
      container.setSize(64, 64);
      container.setInteractive();
      container.setDepth(3);
      
      container.on('pointerdown', () => {
        this.onBuildingClick?.(`agent_${agent.id}`, 'agent_config');
        this.showDialog(agent.name || 'Agente Bot', 
          `Ciao! Sono ${agent.name}, un agente ${agent.agentType}. Sono qui per aiutarti con i tuoi clienti!`);
      });
      
      this.agentHouses.set(agent.id, container);
    });
    
    // Add "build new agent" placeholder if less than max
    if (this.agents.length < GAME_CONFIG.agentQuarter.maxVisible) {
      const x = startX + (this.agents.length * spacing);
      const placeholder = this.add.text(x, startY, '🏗️\n+ Nuovo', {
        font: '12px Arial',
        color: '#94a3b8',
        align: 'center'
      }).setOrigin(0.5).setInteractive();
      
      placeholder.on('pointerdown', () => {
        this.onBuildingClick?.('new_agent', 'create_agent');
      });
    }
  }

  handleBuildingClick(key: string, config: typeof GAME_CONFIG.buildings[keyof typeof GAME_CONFIG.buildings]) {
    const isConfigured = this.configStatus[config.configKey] || false;
    const dialog = NPC_DIALOGS[key];
    
    if (dialog) {
      const message = isConfigured ? dialog.configured : dialog.greeting;
      this.showDialog(config.npc, message);
      this.onDialogOpen?.(config.npc, message, key);
    }
    
    // Mark as visited
    if (this.progress && !this.progress.visitedBuildings.includes(key)) {
      this.progress.visitedBuildings.push(key);
    }
    
    this.onBuildingClick?.(key, config.configKey);
  }

  showDialog(speaker: string, message: string) {
    this.closeDialog();
    
    const width = 600;
    const height = 120;
    const x = 400;
    const y = 520;
    
    this.dialogBox = this.add.container(x, y);
    
    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 0.95);
    bg.fillRoundedRect(-width/2, -height/2, width, height, 12);
    bg.lineStyle(3, 0x4ade80, 1);
    bg.strokeRoundedRect(-width/2, -height/2, width, height, 12);
    
    // Speaker name
    const nameText = this.add.text(-width/2 + 20, -height/2 + 10, `[${speaker}]`, {
      font: 'bold 16px Arial',
      color: '#4ade80'
    });
    
    // Message (animated typing)
    const messageText = this.add.text(-width/2 + 20, -height/2 + 35, '', {
      font: '14px Arial',
      color: '#ffffff',
      wordWrap: { width: width - 40 }
    });
    
    // Close button
    const closeBtn = this.add.text(width/2 - 30, -height/2 + 10, '✕', {
      font: '20px Arial',
      color: '#ef4444'
    }).setInteractive();
    
    closeBtn.on('pointerdown', () => this.closeDialog());
    
    // Continue hint
    const continueHint = this.add.text(width/2 - 20, height/2 - 25, '▼ Clicca per continuare', {
      font: '11px Arial',
      color: '#94a3b8'
    }).setOrigin(1, 0);
    
    this.dialogBox.add([bg, nameText, messageText, closeBtn, continueHint]);
    this.dialogBox.setDepth(100);
    
    // Animate text
    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 30,
      callback: () => {
        messageText.setText(message.substring(0, charIndex));
        charIndex++;
        if (charIndex > message.length) {
          typeTimer.destroy();
        }
      },
      repeat: message.length
    });
    
    // Click to close
    this.dialogBox.setInteractive(new Phaser.Geom.Rectangle(-width/2, -height/2, width, height), Phaser.Geom.Rectangle.Contains);
    this.dialogBox.on('pointerdown', () => {
      if (charIndex >= message.length) {
        this.closeDialog();
      } else {
        charIndex = message.length;
        messageText.setText(message);
      }
    });
  }

  closeDialog() {
    if (this.dialogBox) {
      this.dialogBox.destroy();
      this.dialogBox = null;
    }
  }

  showIntro() {
    this.showDialog('Prof. Setup', 
      "Benvenuto a Coachale Village! Sono il Prof. Setup e ti guiderò nella configurazione della tua piattaforma. " +
      "Esplora il villaggio e parla con gli abitanti per configurare ogni servizio. " +
      "Inizia dalla Torre AI per attivare il cervello della piattaforma!"
    );
  }

  createUI() {
    // Progress bar
    const completed = this.progress?.completedBuildings.length || 0;
    const total = Object.keys(GAME_CONFIG.buildings).length;
    const percentage = Math.round((completed / total) * 100);
    
    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x1e293b, 0.8);
    progressBg.fillRoundedRect(10, 10, 200, 30, 8);
    
    const progressFill = this.add.graphics();
    progressFill.fillStyle(0x4ade80, 1);
    progressFill.fillRoundedRect(15, 15, (190 * percentage) / 100, 20, 6);
    
    this.add.text(110, 25, `⭐ ${percentage}% Completato`, {
      font: '12px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    progressBg.setScrollFactor(0).setDepth(50);
    progressFill.setScrollFactor(0).setDepth(51);
  }

  movePlayerTo(x: number, y: number) {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    const duration = (distance / GAME_CONFIG.player.speed) * 1000;
    
    this.tweens.add({
      targets: this.player,
      x: x,
      y: y,
      duration: duration,
      ease: 'Linear'
    });
  }

  update(time: number, delta: number) {
    if (!this.player || this.dialogBox) return;
    
    let velocityX = 0;
    let velocityY = 0;
    
    // Keyboard controls
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      velocityX = -GAME_CONFIG.player.speed;
    } else if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      velocityX = GAME_CONFIG.player.speed;
    }
    
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) {
      velocityY = -GAME_CONFIG.player.speed;
    } else if (this.cursors?.down.isDown || this.wasd?.S.isDown) {
      velocityY = GAME_CONFIG.player.speed;
    }
    
    // Apply movement
    if (velocityX !== 0 || velocityY !== 0) {
      this.tweens.killTweensOf(this.player);
      this.player.x += velocityX * (delta / 1000);
      this.player.y += velocityY * (delta / 1000);
      
      // Clamp to bounds
      this.player.x = Phaser.Math.Clamp(this.player.x, 20, 780);
      this.player.y = Phaser.Math.Clamp(this.player.y, 20, 580);
    }
    
    // Auto-save position every 2 seconds
    this.saveTimer += delta;
    if (this.saveTimer > 2000) {
      this.saveTimer = 0;
      this.saveProgress();
    }
  }

  saveProgress() {
    if (!this.progress) return;
    
    this.progress.positionX = this.player.x;
    this.progress.positionY = this.player.y;
    
    // Emit save event
    this.game.events.emit('saveProgress', this.progress);
  }

  // Public methods for React integration
  updateConfigStatus(status: Record<string, boolean>) {
    this.configStatus = status;
    
    // Update building tints
    this.buildings.forEach((container, key) => {
      const config = GAME_CONFIG.buildings[key as keyof typeof GAME_CONFIG.buildings];
      if (config) {
        const building = container.getAt(0) as Phaser.GameObjects.Sprite;
        const isConfigured = status[config.configKey] || false;
        
        if (isConfigured) {
          building.clearTint();
          building.setTint(GAME_CONFIG.colors.unlocked);
        } else {
          building.setTint(GAME_CONFIG.colors.locked);
        }
      }
    });
  }

  updateAgents(agents: Agent[]) {
    this.agents = agents;
    // Would need to recreate agent houses - simplified for now
  }
}
