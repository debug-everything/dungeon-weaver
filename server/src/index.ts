import express from 'express';
import cors from 'cors';
import { config } from './config.js';
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
  console.log(`Server running on port ${config.port}`);
  if (config.llm.enabled) {
    console.log(`LLM integration enabled (model: ${config.llm.model})`);
    // Initialize quest pool in background (don't block server startup)
    questPoolService.initialize().catch(err => {
      console.error('Failed to initialize quest pool:', err);
    });
  } else {
    console.log('LLM integration disabled (no LLM_API_KEY set)');
  }
});
