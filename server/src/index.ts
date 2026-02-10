import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger, llmLogger } from './logger.js';
import { gameStateRouter } from './routes/gameState.js';
import { questsRouter } from './routes/quests.js';
import { questPoolService } from './services/questPoolService.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/saves', gameStateRouter);
app.use('/api/quests', questsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', llmEnabled: config.llm.enabled });
});

app.listen(config.port, () => {
  logger.info('Server running on port %d', config.port);
  llmLogger.info('Status: %s', config.llm.enabled ? 'ENABLED' : 'DISABLED');
  if (config.llm.enabled) {
    llmLogger.info('Model: %s | Base URL: %s', config.llm.model, config.llm.baseURL);
    // Initialize quest pool in background (don't block server startup)
    questPoolService.initialize().catch(err => {
      llmLogger.error({ err }, 'Failed to initialize quest pool');
    });
  } else {
    const hasKey = !!process.env.LLM_API_KEY;
    const hasToggle = process.env.LLM_ENABLED === 'true';
    if (!hasToggle && !hasKey) {
      llmLogger.info('Set LLM_ENABLED=true and LLM_API_KEY in server/.env to enable');
    } else if (!hasToggle) {
      llmLogger.info('API key is set but LLM_ENABLED is not "true" — LLM is toggled off');
    } else {
      llmLogger.info('LLM_ENABLED=true but no LLM_API_KEY set — cannot activate');
    }
  }
});
