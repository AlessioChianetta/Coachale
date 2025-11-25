import { WebSocketServer } from 'ws';
import { Server } from 'http';

export function setupWebSocketTest(server: Server) {
  console.log('🔧 Setting up WebSocket test server...');
  
  const wss = new WebSocketServer({ 
    server,
    path: '/ws-test'
  });

  console.log('🔧 WebSocketServer test instance created');

  // Debug: log errors only
  wss.on('error', (error) => {
    console.error('❌ WebSocketServer test error:', error);
  });

  wss.on('connection', (ws, req) => {
    const connectionId = Math.random().toString(36).substring(7);
    console.log(`🔌 WebSocket client connected [${connectionId}]`);
    
    let messageCount = 0;
    
    // Invia un messaggio ogni secondo
    const interval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        messageCount++;
        ws.send(JSON.stringify({ 
          type: 'heartbeat',
          message: 'Messaggio da WebSocket', 
          count: messageCount,
          timestamp: new Date().toISOString() 
        }));
      }
    }, 1000);

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        console.log(`📨 [${connectionId}] Ricevuto:`, parsed.type || 'message', parsed);
        
        // Risponde ai ping con pong
        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ 
            type: 'pong', 
            clientTimestamp: parsed.timestamp,
            serverTimestamp: new Date().toISOString() 
          }));
        } 
        // Test volume dati - risponde con chunk grande
        else if (parsed.type === 'volume-test') {
          const largeData = 'x'.repeat(10000); // 10KB
          ws.send(JSON.stringify({ 
            type: 'volume-response',
            size: largeData.length,
            data: largeData,
            timestamp: new Date().toISOString() 
          }));
        }
        // Echo per altri messaggi
        else {
          ws.send(JSON.stringify({ 
            type: 'echo',
            original: parsed,
            serverTimestamp: new Date().toISOString() 
          }));
        }
      } catch (e) {
        console.log(`📨 [${connectionId}] Ricevuto (raw):`, data.toString());
        ws.send(JSON.stringify({ echo: data.toString() }));
      }
    });

    ws.on('close', () => {
      console.log(`❌ WebSocket client disconnected [${connectionId}] - Messages sent: ${messageCount}`);
      clearInterval(interval);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error [${connectionId}]:`, error);
      clearInterval(interval);
    });
  });

  console.log('✅ WebSocket test server setup on /ws-test');
}
