import Phaser from 'phaser';
import { NPCData } from '../types';
import { SCALE, INTERACTION_DISTANCE, EVENTS } from '../config/constants';

export class NPC extends Phaser.Physics.Arcade.Sprite {
  public npcData: NPCData;
  private interactionIndicator: Phaser.GameObjects.Text | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, data: NPCData) {
    super(scene, x, y, data.sprite);

    this.npcData = data;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(SCALE);
    this.setDepth(5);
    this.setImmovable(true);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 12);
    body.setOffset(2, 4);

    this.createNameTag();
  }

  private createNameTag(): void {
    this.nameText = this.scene.add.text(this.x, this.y - 24, this.npcData.name, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#c9a227',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(100);
  }

  update(): void {
    // Update name tag position (in case NPC moves)
    if (this.nameText) {
      this.nameText.setPosition(this.x, this.y - 24);
    }
  }

  showInteractionPrompt(): void {
    if (this.interactionIndicator) return;

    this.interactionIndicator = this.scene.add.text(this.x, this.y - 40, '[E] Talk', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(200);

    // Bounce animation
    this.scene.tweens.add({
      targets: this.interactionIndicator,
      y: this.y - 45,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  hideInteractionPrompt(): void {
    if (this.interactionIndicator) {
      this.interactionIndicator.destroy();
      this.interactionIndicator = null;
    }
  }

  interact(): void {
    // Show random dialogue
    const dialogue = Phaser.Utils.Array.GetRandom(this.npcData.dialogue);

    // Display dialogue bubble
    const bubble = this.scene.add.text(this.x, this.y - 50, dialogue, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#4a4a6a',
      padding: { x: 8, y: 4 },
      wordWrap: { width: 150 }
    }).setOrigin(0.5).setDepth(300);

    // Fade out after delay
    this.scene.time.delayedCall(2000, () => {
      this.scene.tweens.add({
        targets: bubble,
        alpha: 0,
        y: bubble.y - 20,
        duration: 500,
        onComplete: () => bubble.destroy()
      });
    });

    // Open shop
    this.scene.events.emit(EVENTS.OPEN_SHOP, this.npcData);
  }

  isInRange(x: number, y: number): boolean {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, x, y);
    return distance <= INTERACTION_DISTANCE;
  }

  destroy(fromScene?: boolean): void {
    this.nameText?.destroy();
    this.interactionIndicator?.destroy();
    super.destroy(fromScene);
  }
}
