import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

export class SplashScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.SPLASH });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');

    // Display the splash poster, scaled to fit the game canvas
    const poster = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash_poster');
    const scaleX = GAME_WIDTH / poster.width;
    const scaleY = GAME_HEIGHT / poster.height;
    const scale = Math.min(scaleX, scaleY);
    poster.setScale(scale);
    poster.setAlpha(0);

    // Fade in the poster
    this.tweens.add({
      targets: poster,
      alpha: 1,
      duration: 800,
      ease: 'Sine.easeIn'
    });

    // "Click to continue" prompt, fades in after a short delay
    const prompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Click or press any key to continue', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#aaaaaa'
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: prompt,
      alpha: 1,
      duration: 600,
      delay: 1200,
      ease: 'Sine.easeIn'
    });

    // Pulse the prompt text
    this.tweens.add({
      targets: prompt,
      alpha: 0.4,
      duration: 1000,
      delay: 1800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Transition to menu on any input (after brief delay to prevent accidental skip)
    this.time.delayedCall(800, () => {
      this.input.once('pointerdown', () => this.goToMenu());
      this.input.keyboard?.once('keydown', () => this.goToMenu());
      this.input.gamepad?.once('down', () => this.goToMenu());
    });
  }

  private goToMenu(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }
}
