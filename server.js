'use strict';

/*
 * Clash of Legends — WebRTC P2P Voice Chat Signaling Server
 * ==========================================================
 * This server ONLY brokers peer discovery and WebRTC signaling.
 * Audio never passes through this server: after SDP+ICE exchange the two
 * players stream peer-to-peer directly (STUN only, low latency).
 *
 * Endpoints:
 *   GET  /health                -> {"status":"OK","message":"Server Active"}
 *   WS   /peerjs/peerjs?key=&id= -> WebRTC signaling socket (PeerServer)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: allow any origin (game clients connect from any web/Android origin).
app.use(cors());
app.use(express.json());

// Health check for Render (also used by the keep-alive cron).
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server Active' });
});

app.get('/', (req, res) => {
  res.json({
    name: 'voice-signaling-server',
    status: 'OK',
    health: '/health',
    signaling: '/peerjs'
  });
});

const httpServer = http.createServer(app);

// PeerServer handles the WebSocket signaling protocol that the Android client
// (PeerSignalingClient + VoiceChatManager) speaks.
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  allow_discovery: true,
  // Mounted as app.use('/peerjs', peerServer), so the PeerServer path itself
  // must be '/'. This yields the classic WebSocket URL the Android client uses:
  //   wss://<host>/peerjs/peerjs?key=peerjs&id=<player>&token=<token>
  path: '/',
  proxied: true
});

app.use('/peerjs', peerServer);

// Log peer lifecycle events: each player that enters the voice chat gets an id
// made of its in-game username; these logs help admins debug connectivity.
peerServer.on('connection', (client) => {
  const id = (client && client.getId) ? client.getId() : 'unknown';
  console.log('[voice] peer connected: ' + id);
});

peerServer.on('disconnect', (client) => {
  const id = (client && client.getId) ? client.getId() : 'unknown';
  console.log('[voice] peer disconnected: ' + id);
});

peerServer.on('error', (err) => {
  console.error('[voice] signaling error:', (err && err.message) || err);
});

httpServer.on('error', (err) => {
  console.error('[voice] http error:', (err && err.message) || err);
});

httpServer.listen(PORT, () => {
  console.log('[voice] Clash of Legends Voice Signaling Server');
  console.log('[voice] Health:  http://localhost:' + PORT + '/health');
  console.log('[voice] Signaling: ws://localhost:' + PORT + '/peerjs/peerjs?key=peerjs');
});

// Keep-alive: Render free-tier sleeps idle instances; ping ourselves hourly so
// the signaling socket stays warm for long voice sessions.
const KEEPALIVE_MIN = process.env.KEEPALIVE_MIN || 60;
setInterval(() => {
  try {
    const req = http.get('http://localhost:' + PORT + '/health', (res) => { res.resume(); });
    req.setTimeout(10000, () => { try { req.destroy(); } catch (e) {} });
    req.on('error', () => {});
  } catch (e) {}
}, KEEPALIVE_MIN * 60 * 1000).unref();

// Prevent a single unhandled rejection from killing the signaling process.
process.on('unhandledRejection', (reason) => {
  console.error('[voice] unhandled rejection (recovered):', (reason && reason.message) || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[voice] uncaught exception (recovered):', (err && err.message) || err);
});

module.exports = { app, httpServer, peerServer };