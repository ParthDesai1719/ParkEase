import 'dotenv/config';

import { createServer } from 'node:http';

import { Server } from 'socket.io';

import app from './app.js';

const PORT = Number(process.env.PORT) || 5000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`ParkEase API running on http://localhost:${PORT}`);
});
