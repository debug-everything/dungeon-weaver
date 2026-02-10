export const config = {
  port: parseInt(process.env.PORT || '4201', 10),
  databasePath: process.env.DATABASE_PATH || './data/game.db',
  llm: {
    enabled: (process.env.LLM_ENABLED === 'true') && !!process.env.LLM_API_KEY,
    apiKey: process.env.LLM_API_KEY || '',
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL || 'gpt-4.1-mini'
  }
};
