import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load game config
interface GameConfig {
  storyArc: { questsPerArc: number; bossQuestEnabled: boolean };
  aiPatterns?: {
    chainingEnabled?: boolean;
    evaluatorEnabled?: boolean;
    evaluatorThreshold?: number;
    evaluatorMaxRetries?: number;
    routingEnabled?: boolean;
    introNarrationEnabled?: boolean;
  };
}

function loadGameConfig(): GameConfig {
  try {
    const raw = readFileSync(resolve(__dirname, '..', 'game.config.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { storyArc: { questsPerArc: 3, bossQuestEnabled: true } };
  }
}

export const gameConfig = loadGameConfig();

export const config = {
  port: parseInt(process.env.PORT || '4201', 10),
  databasePath: process.env.DATABASE_PATH || './data/game.db',
  llm: {
    enabled: (process.env.LLM_ENABLED === 'true') && !!process.env.LLM_API_KEY,
    apiKey: process.env.LLM_API_KEY || '',
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL || 'gpt-4.1-mini',
    modelFast: process.env.LLM_MODEL_FAST || process.env.LLM_MODEL || 'gpt-4.1-nano'
  },
  storyArcDailyMax: parseInt(process.env.STORY_ARC_DAILY_MAX || '5', 10)
};
