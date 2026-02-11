import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '20px monospace',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x8b4513, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load player
    this.load.image('hero_basic', 'assets/items/hero_basic.png');

    // Load monsters
    this.load.image('monster_zombie', 'assets/items/monster_zombie.png');
    this.load.image('monster_skelet', 'assets/items/monster_skelet.png');
    this.load.image('monster_orc', 'assets/items/monster_orc.png');
    this.load.image('monster_goblin', 'assets/items/monster_goblin.png');
    this.load.image('monster_demon', 'assets/items/monster_demon.png');

    // Load NPCs
    this.load.image('npc_merchant', 'assets/items/npc_merchant.png');
    this.load.image('npc_merchant_2', 'assets/items/npc_merchant_2.png');
    this.load.image('npc_sage', 'assets/items/npc_sage.png');

    // Load weapons
    this.load.image('weapon_sword_wooden', 'assets/items/weapon_sword_wooden.png');
    this.load.image('weapon_sword_rusty', 'assets/items/weapon_sword_rusty.png');
    this.load.image('weapon_sword_steel', 'assets/items/weapon_sword_steel.png');
    this.load.image('weapon_sword_silver', 'assets/items/weapon_sword_silver.png');
    this.load.image('weapon_sword_ruby', 'assets/items/weapon_sword_ruby.png');
    this.load.image('weapon_sword_golden', 'assets/items/weapon_sword_golden.png');
    this.load.image('weapon_dagger_small', 'assets/items/weapon_dagger_small.png');
    this.load.image('weapon_dagger_steel', 'assets/items/weapon_dagger_steel.png');
    this.load.image('weapon_dagger_golden', 'assets/items/weapon_dagger_golden.png');
    this.load.image('weapon_hammer', 'assets/items/weapon_hammer.png');
    this.load.image('weapon_sledgehammer', 'assets/items/weapon_sledgehammer.png');
    this.load.image('weapon_katana_silver', 'assets/items/weapon_katana_silver.png');

    // Load potions
    this.load.image('flask_red', 'assets/items/flask_red.png');
    this.load.image('flask_big_red', 'assets/items/flask_big_red.png');
    this.load.image('flask_blue', 'assets/items/flask_blue.png');
    this.load.image('flask_green', 'assets/items/flask_green.png');
    this.load.image('flask_yellow', 'assets/items/flask_yellow.png');

    // Load environment
    this.load.image('floor_plain', 'assets/items/floor_plain.png');
    this.load.image('floor_stain_1', 'assets/items/floor_stain_1.png');
    this.load.image('floor_stain_2', 'assets/items/floor_stain_2.png');
    this.load.image('wall_center', 'assets/items/wall_center.png');
    this.load.image('wall_left', 'assets/items/wall_left.png');
    this.load.image('wall_right', 'assets/items/wall_right.png');
    this.load.image('wall_top_center', 'assets/items/wall_top_center.png');
    this.load.image('wall_top_left', 'assets/items/wall_top_left.png');
    this.load.image('wall_top_right', 'assets/items/wall_top_right.png');
    this.load.image('door_closed', 'assets/items/door_closed.png');
    this.load.image('door_open', 'assets/items/door_open.png');
    this.load.image('chest_closed', 'assets/items/chest_closed.png');
    this.load.image('chest_open_empty', 'assets/items/chest_open_empty.png');
    this.load.image('chest_open_full', 'assets/items/chest_open_full.png');

    // Load UI elements
    this.load.image('box', 'assets/items/box.png');

    // Generate armor placeholder sprites
    this.generateArmorSprites();
  }

  create(): void {
    this.scene.start(SCENE_KEYS.MENU);
  }

  private generateArmorSprites(): void {
    // --- Helmets ---
    this.drawArmor('armor_head_leather', (ctx) => {
      // Brown leather cap
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(3, 4, 10, 8);
      ctx.fillStyle = '#6B3E1C';
      ctx.fillRect(2, 8, 12, 4);
      ctx.fillStyle = '#A07050';
      ctx.fillRect(5, 5, 6, 3);
    });
    this.drawArmor('armor_head_iron', (ctx) => {
      // Gray iron helm
      ctx.fillStyle = '#888888';
      ctx.fillRect(3, 3, 10, 9);
      ctx.fillStyle = '#666666';
      ctx.fillRect(2, 8, 12, 4);
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(5, 4, 6, 3);
      // Nose guard
      ctx.fillStyle = '#777777';
      ctx.fillRect(7, 8, 2, 4);
    });
    this.drawArmor('armor_head_golden', (ctx) => {
      // Gold helm
      ctx.fillStyle = '#DAA520';
      ctx.fillRect(3, 3, 10, 9);
      ctx.fillStyle = '#B8860B';
      ctx.fillRect(2, 8, 12, 4);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(5, 4, 6, 3);
      // Crown detail
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(4, 2, 2, 2);
      ctx.fillRect(7, 1, 2, 3);
      ctx.fillRect(10, 2, 2, 2);
    });

    // --- Chestplates ---
    this.drawArmor('armor_chest_leather', (ctx) => {
      // Brown leather vest
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(3, 2, 10, 11);
      ctx.fillStyle = '#6B3E1C';
      ctx.fillRect(4, 3, 3, 9);
      ctx.fillRect(9, 3, 3, 9);
      ctx.fillStyle = '#A07050';
      ctx.fillRect(6, 4, 4, 4);
    });
    this.drawArmor('armor_chest_chain', (ctx) => {
      // Gray chain mail
      ctx.fillStyle = '#888888';
      ctx.fillRect(3, 2, 10, 11);
      ctx.fillStyle = '#AAAAAA';
      // Chain pattern
      for (let y = 3; y < 12; y += 2) {
        for (let x = 4; x < 12; x += 2) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.fillStyle = '#666666';
      ctx.fillRect(3, 2, 10, 1);
      ctx.fillRect(3, 12, 10, 1);
    });
    this.drawArmor('armor_chest_plate', (ctx) => {
      // Silver plate armor
      ctx.fillStyle = '#B0B0B0';
      ctx.fillRect(3, 2, 10, 11);
      ctx.fillStyle = '#D0D0D0';
      ctx.fillRect(5, 3, 6, 5);
      ctx.fillStyle = '#808080';
      ctx.fillRect(3, 2, 10, 1);
      ctx.fillRect(3, 12, 10, 1);
      ctx.fillRect(4, 8, 8, 1);
      // Chest emblem
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(7, 4, 2, 2);
    });

    // --- Leggings ---
    this.drawArmor('armor_legs_leather', (ctx) => {
      // Brown leather pants
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(4, 2, 8, 5);
      ctx.fillStyle = '#6B3E1C';
      ctx.fillRect(4, 7, 3, 6);
      ctx.fillRect(9, 7, 3, 6);
      ctx.fillStyle = '#A07050';
      ctx.fillRect(7, 2, 2, 4);
    });
    this.drawArmor('armor_legs_chain', (ctx) => {
      // Gray chain leggings
      ctx.fillStyle = '#888888';
      ctx.fillRect(4, 2, 8, 5);
      ctx.fillStyle = '#777777';
      ctx.fillRect(4, 7, 3, 6);
      ctx.fillRect(9, 7, 3, 6);
      ctx.fillStyle = '#AAAAAA';
      for (let y = 3; y < 12; y += 2) {
        ctx.fillRect(5, y, 1, 1);
        ctx.fillRect(10, y, 1, 1);
      }
    });
    this.drawArmor('armor_legs_plate', (ctx) => {
      // Silver plate greaves
      ctx.fillStyle = '#B0B0B0';
      ctx.fillRect(4, 2, 8, 5);
      ctx.fillStyle = '#A0A0A0';
      ctx.fillRect(4, 7, 3, 6);
      ctx.fillRect(9, 7, 3, 6);
      ctx.fillStyle = '#D0D0D0';
      ctx.fillRect(5, 3, 2, 3);
      ctx.fillRect(9, 3, 2, 3);
      ctx.fillStyle = '#808080';
      ctx.fillRect(4, 7, 3, 1);
      ctx.fillRect(9, 7, 3, 1);
    });

    // --- Boots ---
    this.drawArmor('armor_boots_leather', (ctx) => {
      // Brown leather boots
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(2, 5, 4, 6);
      ctx.fillRect(10, 5, 4, 6);
      ctx.fillStyle = '#6B3E1C';
      ctx.fillRect(1, 10, 6, 3);
      ctx.fillRect(9, 10, 6, 3);
      ctx.fillStyle = '#A07050';
      ctx.fillRect(3, 5, 2, 2);
      ctx.fillRect(11, 5, 2, 2);
    });
    this.drawArmor('armor_boots_iron', (ctx) => {
      // Gray iron boots
      ctx.fillStyle = '#888888';
      ctx.fillRect(2, 5, 4, 6);
      ctx.fillRect(10, 5, 4, 6);
      ctx.fillStyle = '#666666';
      ctx.fillRect(1, 10, 6, 3);
      ctx.fillRect(9, 10, 6, 3);
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(3, 6, 2, 2);
      ctx.fillRect(11, 6, 2, 2);
    });
    this.drawArmor('armor_boots_steel', (ctx) => {
      // Silver steel boots
      ctx.fillStyle = '#B0B0B0';
      ctx.fillRect(2, 5, 4, 6);
      ctx.fillRect(10, 5, 4, 6);
      ctx.fillStyle = '#808080';
      ctx.fillRect(1, 10, 6, 3);
      ctx.fillRect(9, 10, 6, 3);
      ctx.fillStyle = '#D0D0D0';
      ctx.fillRect(3, 6, 2, 2);
      ctx.fillRect(11, 6, 2, 2);
      // Steel trim
      ctx.fillStyle = '#E0E0E0';
      ctx.fillRect(2, 5, 4, 1);
      ctx.fillRect(10, 5, 4, 1);
    });

    // --- Shields ---
    this.drawArmor('armor_shield_wooden', (ctx) => {
      // Brown wooden shield
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(4, 2, 8, 12);
      ctx.fillStyle = '#6B3E1C';
      ctx.fillRect(3, 4, 1, 8);
      ctx.fillRect(12, 4, 1, 8);
      ctx.fillStyle = '#A07050';
      ctx.fillRect(6, 4, 4, 2);
      // Cross brace
      ctx.fillStyle = '#6B3E1C';
      ctx.fillRect(7, 3, 2, 10);
      ctx.fillRect(5, 7, 6, 2);
    });
    this.drawArmor('armor_shield_iron', (ctx) => {
      // Gray iron shield
      ctx.fillStyle = '#888888';
      ctx.fillRect(4, 2, 8, 12);
      ctx.fillStyle = '#666666';
      ctx.fillRect(3, 4, 1, 8);
      ctx.fillRect(12, 4, 1, 8);
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(6, 4, 4, 8);
      // Metal boss
      ctx.fillStyle = '#CCCCCC';
      ctx.fillRect(7, 7, 2, 2);
    });
    this.drawArmor('armor_shield_golden', (ctx) => {
      // Gold shield
      ctx.fillStyle = '#DAA520';
      ctx.fillRect(4, 2, 8, 12);
      ctx.fillStyle = '#B8860B';
      ctx.fillRect(3, 4, 1, 8);
      ctx.fillRect(12, 4, 1, 8);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(6, 4, 4, 8);
      // Gold emblem
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 6, 2, 4);
      ctx.fillRect(6, 7, 4, 2);
    });
  }

  private drawArmor(key: string, draw: (ctx: CanvasRenderingContext2D) => void): void {
    const canvas = this.textures.createCanvas(key, 16, 16);
    if (!canvas) return;
    const ctx = canvas.getContext();
    draw(ctx);
    canvas.refresh();
  }
}
