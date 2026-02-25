import Phaser from 'phaser';
import { SCENE_KEYS, EVENTS, PLAYER_OVERLAY_TABS, GAME_WIDTH } from '../config/constants';
import type { GameScene } from '../scenes/GameScene';

/**
 * Launch an overlay tab directly, bypassing GameScene event handlers.
 * This avoids Phaser scene lifecycle issues when stopping one overlay and launching another.
 *
 * @param callingScene - The current overlay scene (will be stopped)
 * @param tabKey - The target tab to launch
 */
export function launchOverlayTab(callingScene: Phaser.Scene, tabKey: string): void {
  const gameScene = callingScene.scene.get(SCENE_KEYS.GAME) as GameScene;
  const player = gameScene.getPlayer();

  // Launch target scene with appropriate data
  switch (tabKey) {
    case 'INVENTORY':
      callingScene.scene.launch(SCENE_KEYS.INVENTORY, {
        inventory: player.inventory,
        player
      });
      break;
    case 'QUEST_LOG':
      callingScene.scene.launch(SCENE_KEYS.QUEST_LOG, {
        questSystem: gameScene.questSystem
      });
      break;
    case 'MAP':
      callingScene.scene.launch(SCENE_KEYS.MAP, {
        dungeon: gameScene.getDungeon(),
        rooms: gameScene.getRooms(),
        fogSystem: gameScene.fogSystem,
        playerX: player.x,
        playerY: player.y,
        npcs: gameScene.getNPCs().getChildren().map((n: Phaser.GameObjects.GameObject) => {
          const npc = n as unknown as { x: number; y: number; npcData: { name: string } };
          return { x: npc.x, y: npc.y, name: npc.npcData.name };
        }),
        monsters: gameScene.getMonsters().getChildren().map((m: Phaser.GameObjects.GameObject) => {
          const monster = m as unknown as { x: number; y: number; active: boolean };
          return { x: monster.x, y: monster.y, active: monster.active };
        }),
        questSystem: gameScene.questSystem
      });
      break;
    case 'LEVEL_UP':
      callingScene.scene.launch(SCENE_KEYS.LEVEL_UP, { player });
      break;
  }

  // Stop the current scene after launching the new one
  callingScene.scene.stop();
}

/**
 * Get the next tab key in the cycle.
 */
export function getNextTab(currentTab: typeof PLAYER_OVERLAY_TABS[number]): string {
  const currentIdx = PLAYER_OVERLAY_TABS.indexOf(currentTab);
  const nextIdx = (currentIdx + 1) % PLAYER_OVERLAY_TABS.length;
  return PLAYER_OVERLAY_TABS[nextIdx];
}

/** Map from tab key to keyboard shortcut key code */
const TAB_HOTKEYS: Record<string, string> = {
  INVENTORY: 'I',
  QUEST_LOG: 'Q',
  MAP: 'M',
  LEVEL_UP: 'L',
};

/**
 * Bind shortcut keys (I, Q, M, L) so they switch directly to the corresponding tab
 * from any overlay scene. The key for the active tab acts as "close" (handled by each scene).
 */
export function bindTabShortcuts(
  scene: Phaser.Scene,
  activeTab: typeof PLAYER_OVERLAY_TABS[number],
  closeScene: () => void
): void {
  if (!scene.input.keyboard) return;

  for (const tab of PLAYER_OVERLAY_TABS) {
    const key = TAB_HOTKEYS[tab];
    if (!key) continue;

    if (tab === activeTab) {
      // The active tab's own key closes the overlay
      scene.input.keyboard.on(`keydown-${key}`, () => closeScene());
    } else {
      // Other tab keys switch directly
      scene.input.keyboard.on(`keydown-${key}`, () => launchOverlayTab(scene, tab));
    }
  }
}

/**
 * Create the tab bar UI for an overlay scene.
 */
export function createTabBar(
  scene: Phaser.Scene,
  activeTab: typeof PLAYER_OVERLAY_TABS[number],
  onSwitch: (tabKey: string) => void
): void {
  const tabLabels: Record<string, string> = {
    INVENTORY: 'Inventory (I)',
    QUEST_LOG: 'Quests (Q)',
    MAP: 'Map (M)',
    LEVEL_UP: 'Stats (L)',
  };
  const tabWidth = GAME_WIDTH / PLAYER_OVERLAY_TABS.length;

  for (let i = 0; i < PLAYER_OVERLAY_TABS.length; i++) {
    const tabKey = PLAYER_OVERLAY_TABS[i];
    const isActive = tabKey === activeTab;
    const x = tabWidth * i + tabWidth / 2;

    const tabBg = scene.add.rectangle(x, 14, tabWidth - 4, 24, isActive ? 0x334455 : 0x111111, 0.9);
    tabBg.setStrokeStyle(1, isActive ? 0xc9a227 : 0x333333);
    tabBg.setInteractive({ useHandCursor: true });
    tabBg.on('pointerdown', () => {
      if (tabKey !== activeTab) onSwitch(tabKey);
    });

    scene.add.text(x, 14, tabLabels[tabKey] || tabKey, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: isActive ? '#ffd700' : '#666666'
    }).setOrigin(0.5);
  }
}
