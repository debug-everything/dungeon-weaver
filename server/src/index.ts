import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { logger, llmLogger } from './logger.js';
import { gameStateRouter } from './routes/gameState.js';
import { questsRouter } from './routes/quests.js';
import { questPoolService } from './services/questPoolService.js';
import { debugRouter } from './routes/debug.js';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false  // Phaser needs inline scripts/eval
}));

// CORS — locked to specific origin in production via CORS_ORIGIN env var
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(s => s.trim())
}));

app.use(express.json({ limit: '512kb' }));

// Rate limiting
const apiLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const apiLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
const llmLimitMax = parseInt(process.env.RATE_LIMIT_LLM_MAX || '10', 10);

app.use('/api', rateLimit({ windowMs: apiLimitWindow, max: apiLimitMax, standardHeaders: true, legacyHeaders: false }));
app.use('/api/quests', rateLimit({ windowMs: apiLimitWindow, max: llmLimitMax, standardHeaders: true, legacyHeaders: false }));

// Routes
app.use('/api/saves', gameStateRouter);
app.use('/api/quests', questsRouter);
app.use('/api/debug', debugRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', llmEnabled: config.llm.enabled });
});

// In production, serve the Vite-built frontend as static files
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    // SPA fallback — always serve index.html for non-static routes
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(config.port, '0.0.0.0', () => {
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
