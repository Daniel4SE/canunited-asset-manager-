import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { JWTPayload } from '../middleware/auth.js';
import { WSEventType, WSMessage } from '../types/index.js';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  user?: JWTPayload;
  subscriptions: Set<string>;
}

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: WebSocketServer): void {
  wss = server;
  
  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    wss?.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (!extWs.isAlive) {
        return extWs.terminate();
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  server.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  server.on('connection', (ws: WebSocket, req) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.isAlive = true;
    extWs.subscriptions = new Set();

    // Authenticate via query parameter
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (token) {
      try {
        extWs.user = jwt.verify(token, config.jwt.secret) as JWTPayload;
        console.log(`WebSocket authenticated: ${extWs.user.email}`);
      } catch (error) {
        console.warn('WebSocket authentication failed');
      }
    }

    // Handle pong
    ws.on('pong', () => {
      extWs.isAlive = true;
    });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(extWs, message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    // Send connection confirmation
    sendToClient(ws, {
      type: WSEventType.GATEWAY_STATUS,
      payload: { status: 'connected' },
      timestamp: new Date().toISOString()
    });
  });

  console.log('✅ WebSocket server initialized');
}

function handleMessage(ws: ExtendedWebSocket, message: { type: string; payload: unknown }): void {
  switch (message.type) {
    case 'subscribe':
      const subscribePayload = message.payload as { channel: string };
      ws.subscriptions.add(subscribePayload.channel);
      console.log(`Client subscribed to: ${subscribePayload.channel}`);
      break;
      
    case 'unsubscribe':
      const unsubscribePayload = message.payload as { channel: string };
      ws.subscriptions.delete(unsubscribePayload.channel);
      console.log(`Client unsubscribed from: ${unsubscribePayload.channel}`);
      break;
      
    case 'ping':
      sendToClient(ws, {
        type: WSEventType.GATEWAY_STATUS,
        payload: { pong: true },
        timestamp: new Date().toISOString()
      });
      break;
      
    default:
      console.warn('Unknown message type:', message.type);
  }
}

function sendToClient(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Broadcast to all connected clients
export function broadcast(message: WSMessage): void {
  wss?.clients.forEach((client) => {
    sendToClient(client, message);
  });
}

// Broadcast to specific channel subscribers
export function broadcastToChannel(channel: string, message: WSMessage): void {
  wss?.clients.forEach((client) => {
    const extClient = client as ExtendedWebSocket;
    if (extClient.subscriptions.has(channel)) {
      sendToClient(client, message);
    }
  });
}

// Broadcast to specific organization
export function broadcastToOrganization(organizationId: string, message: WSMessage): void {
  wss?.clients.forEach((client) => {
    const extClient = client as ExtendedWebSocket;
    if (extClient.user?.organizationId === organizationId) {
      sendToClient(client, message);
    }
  });
}

// Broadcast to specific site
export function broadcastToSite(siteId: string, message: WSMessage): void {
  wss?.clients.forEach((client) => {
    const extClient = client as ExtendedWebSocket;
    if (extClient.user?.siteAccess.includes(siteId) || extClient.user?.siteAccess.includes('*')) {
      sendToClient(client, message);
    }
  });
}
