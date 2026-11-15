import 'dotenv/config';

import { createServer } from 'node:http';

import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { initSocket } from './socket.js';

const PORT = Number(process.env.PORT) || 5000;

const httpServer = createServer(app);

// Initialize Socket.io server
initSocket(httpServer);

async function startServer(): Promise<void> {
  await connectDatabase();

  httpServer.listen(PORT, () => {
    console.log(`ParkEase API running on http://localhost:${PORT}`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Failed to start ParkEase API:', error);
  process.exit(1);
});
