import 'dotenv/config';

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3002', 10),
  PLUGGY_BASE_URL: process.env.PLUGGY_BASE_URL || 'https://api.pluggy.ai',
  PLUGGY_CLIENT_ID: process.env.PLUGGY_CLIENT_ID || '',
  PLUGGY_SECRET: process.env.PLUGGY_SECRET || '',
  API_SECRET_KEY: process.env.API_SECRET_KEY || '',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3002'
};

if (!CONFIG.PLUGGY_CLIENT_ID || !CONFIG.PLUGGY_SECRET) {
  console.warn('[warn] Falta PLUGGY_CLIENT_ID o PLUGGY_SECRET en .env');
}
