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

    // Load monsters — Undead family
    this.load.image('monster_zombie', 'assets/items/monster_zombie.png');
    this.load.image('monster_zombie_small', 'assets/items/monster_zombie_small.png');
    this.load.image('monster_zombie_green', 'assets/items/monster_zombie_green.png');
    this.load.image('monster_zombie_tall', 'assets/items/monster_zombie_tall.png');
    this.load.image('monster_skelet', 'assets/items/monster_skelet.png');
    this.load.image('monster_necromancer', 'assets/items/monster_necromancer.png');

    // Load monsters — Beast family
    this.load.image('monster_bat', 'assets/items/monster_bat.png');
    this.load.image('monster_wogol', 'assets/items/monster_wogol.png');
    this.load.image('monster_rokita', 'assets/items/monster_rokita.png');
    this.load.image('monster_tentackle', 'assets/items/monster_tentackle.png');

    // Load monsters — Orc family
    this.load.image('monster_goblin', 'assets/items/monster_goblin.png');
    this.load.image('monster_orc', 'assets/items/monster_orc.png');
    this.load.image('monster_orc_armored', 'assets/items/monster_orc_armored.png');
    this.load.image('monster_orc_masked', 'assets/items/monster_orc_masked.png');
    this.load.image('monster_orc_shaman', 'assets/items/monster_orc_shaman.png');
    this.load.image('monster_orc_veteran', 'assets/items/monster_orc_veteran.png');
    this.load.image('monster_ogre', 'assets/items/monster_ogre.png');

    // Load monsters — Demon family
    this.load.image('monster_imp', 'assets/items/monster_imp.png');
    this.load.image('monster_chort', 'assets/items/monster_chort.png');
    this.load.image('monster_bies', 'assets/items/monster_bies.png');
    this.load.image('monster_demon', 'assets/items/monster_demon.png');

    // Load monsters — Elemental family
    this.load.image('monster_elemental_goo', 'assets/items/monster_elemental_goo.png');
    this.load.image('monster_elemental_fire', 'assets/items/monster_elemental_fire.png');
    this.load.image('monster_elemental_water', 'assets/items/monster_elemental_water.png');
    this.load.image('monster_elemental_air', 'assets/items/monster_elemental_air.png');
    this.load.image('monster_elemental_earth', 'assets/items/monster_elemental_earth.png');
    this.load.image('monster_elemental_plant', 'assets/items/monster_elemental_plant.png');
    this.load.image('monster_elemental_gold', 'assets/items/monster_elemental_gold_tall.png');

    // Load monsters — Dark Knight
    this.load.image('monster_dark_knight', 'assets/items/monster_dark_knight.png');

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

    // Load outfit sprites (reuse NPC sprite PNGs)
    this.load.image('npc_elf', 'assets/items/npc_elf.png');
    this.load.image('npc_trickster', 'assets/items/npc_trickster.png');
    this.load.image('npc_wizzard', 'assets/items/npc_wizzard.png');
    this.load.image('npc_dwarf', 'assets/items/npc_dwarf.png');
    this.load.image('npc_knight_blue', 'assets/items/npc_knight_blue.png');

    // Generate shield placeholder sprites
    this.generateShieldSprites();

    // Generate spell book sprites
    this.generateSpellBookSprites();
  }

  create(): void {
    this.scene.start(SCENE_KEYS.MENU);
  }

  private generateShieldSprites(): void {
    this.drawArmor('armor_shield_wooden', (ctx) => {
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(4, 2, 8, 12);
      ctx.fillStyle = '#6B3E1C';
      ctx.fillRect(3, 4, 1, 8);
      ctx.fillRect(12, 4, 1, 8);
      ctx.fillStyle = '#A07050';
      ctx.fillRect(6, 4, 4, 2);
      ctx.fillStyle = '#6B3E1C';
      ctx.fillRect(7, 3, 2, 10);
      ctx.fillRect(5, 7, 6, 2);
    });
    this.drawArmor('armor_shield_iron', (ctx) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(4, 2, 8, 12);
      ctx.fillStyle = '#666666';
      ctx.fillRect(3, 4, 1, 8);
      ctx.fillRect(12, 4, 1, 8);
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(6, 4, 4, 8);
      ctx.fillStyle = '#CCCCCC';
      ctx.fillRect(7, 7, 2, 2);
    });
    this.drawArmor('armor_shield_golden', (ctx) => {
      ctx.fillStyle = '#DAA520';
      ctx.fillRect(4, 2, 8, 12);
      ctx.fillStyle = '#B8860B';
      ctx.fillRect(3, 4, 1, 8);
      ctx.fillRect(12, 4, 1, 8);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(6, 4, 4, 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 6, 2, 4);
      ctx.fillRect(6, 7, 4, 2);
    });
  }

  private generateSpellBookSprites(): void {
    // Fireball tome — red/orange book
    this.drawArmor('spell_fireball', (ctx) => {
      // Book body
      ctx.fillStyle = '#8B2500';
      ctx.fillRect(3, 2, 10, 12);
      // Spine
      ctx.fillStyle = '#5C1A00';
      ctx.fillRect(3, 2, 2, 12);
      // Pages
      ctx.fillStyle = '#F5DEB3';
      ctx.fillRect(5, 3, 7, 10);
      // Fire symbol
      ctx.fillStyle = '#FF4400';
      ctx.fillRect(7, 5, 3, 4);
      ctx.fillStyle = '#FFAA00';
      ctx.fillRect(8, 4, 1, 2);
      ctx.fillStyle = '#FF6600';
      ctx.fillRect(7, 6, 3, 2);
    });

    // Lightning tome — blue book
    this.drawArmor('spell_lightning', (ctx) => {
      // Book body
      ctx.fillStyle = '#1A3A6B';
      ctx.fillRect(3, 2, 10, 12);
      // Spine
      ctx.fillStyle = '#0F2244';
      ctx.fillRect(3, 2, 2, 12);
      // Pages
      ctx.fillStyle = '#F5DEB3';
      ctx.fillRect(5, 3, 7, 10);
      // Lightning bolt symbol
      ctx.fillStyle = '#4488FF';
      ctx.fillRect(8, 4, 2, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 6, 2, 1);
      ctx.fillStyle = '#4488FF';
      ctx.fillRect(7, 7, 2, 2);
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
