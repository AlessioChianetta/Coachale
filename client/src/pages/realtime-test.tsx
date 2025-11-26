import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RealtimeTest() {
  // WebSocket state
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [wsMessages, setWsMessages] = useState<string[]>([]);
  const [wsPing, setWsPing] = useState<number | null>(null);
  const [wsStats, setWsStats] = useState({ sent: 0, received: 0, errors: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const [customMessage, setCustomMessage] = useState('');

  // SSE state
  const [sseStatus, setSseStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [sseMessages, setSseMessages] = useState<string[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  // WebSocket connection
  const connectWebSocket = () => {
    setWsStatus('connecting');
    setWsMessages([]);
    setWsStats({ sent: 0, received: 0, errors: 0 });
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-test`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        setWsMessages(prev => [...prev, '✅ Connesso al WebSocket server']);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setWsStats(prev => ({ ...prev, received: prev.received + 1 }));
          
          if (data.type === 'heartbeat') {
            setWsMessages(prev => [...prev, `💓 ${data.message} #${data.count} - ${new Date(data.timestamp).toLocaleTimeString()}`]);
          } else if (data.type === 'pong') {
            const latency = Date.now() - new Date(data.clientTimestamp).getTime();
            setWsPing(latency);
            setWsMessages(prev => [...prev, `🏓 Pong ricevuto - Latenza: ${latency}ms`]);
          } else if (data.type === 'echo') {
            setWsMessages(prev => [...prev, `🔁 Echo: ${JSON.stringify(data.original)}`]);
          } else if (data.type === 'volume-response') {
            setWsMessages(prev => [...prev, `📦 Ricevuti ${(data.size / 1024).toFixed(1)}KB in un singolo messaggio`]);
          } else {
            setWsMessages(prev => [...prev, `📨 ${JSON.stringify(data)}`]);
          }
        } catch (e) {
          setWsMessages(prev => [...prev, `📨 ${event.data}`]);
        }
      };

      ws.onerror = (error) => {
        setWsStatus('error');
        setWsStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        setWsMessages(prev => [...prev, '❌ Errore WebSocket']);
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        setWsMessages(prev => [...prev, '🔌 Disconnesso']);
      };
    } catch (error) {
      setWsStatus('error');
      setWsMessages(prev => [...prev, `❌ Errore: ${error}`]);
    }
  };

  // Test ping WebSocket
  const testPing = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const pingData = {
        type: 'ping',
        timestamp: new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(pingData));
      setWsStats(prev => ({ ...prev, sent: prev.sent + 1 }));
      setWsMessages(prev => [...prev, '🏓 Ping inviato...']);
    }
  };

  // Test volume dati
  const testVolume = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const volumeData = {
        type: 'volume-test',
        timestamp: new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(volumeData));
      setWsStats(prev => ({ ...prev, sent: prev.sent + 1 }));
      setWsMessages(prev => [...prev, '📦 Test volume dati inviato...']);
    }
  };

  // Invia messaggio personalizzato
  const sendCustomMessage = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && customMessage.trim()) {
      const messageData = {
        type: 'custom',
        message: customMessage
      };
      wsRef.current.send(JSON.stringify(messageData));
      setWsStats(prev => ({ ...prev, sent: prev.sent + 1 }));
      setWsMessages(prev => [...prev, `📤 Inviato: ${customMessage}`]);
      setCustomMessage('');
    }
  };

  // SSE connection
  const connectSSE = () => {
    setSseStatus('connecting');
    setSseMessages([]);
    
    try {
      const sseUrl = '/api/sse-test';
      const eventSource = new EventSource(sseUrl);
      sseRef.current = eventSource;

      eventSource.onopen = () => {
        setSseStatus('connected');
        setSseMessages(prev => [...prev, '✅ Connesso al SSE server']);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setSseMessages(prev => [...prev, `📡 ${data.message} #${data.counter} - ${new Date(data.timestamp).toLocaleTimeString()}`]);
        } catch (e) {
          setSseMessages(prev => [...prev, `📡 ${event.data}`]);
        }
      };

      eventSource.onerror = (error) => {
        setSseStatus('error');
        setSseMessages(prev => [...prev, '❌ Errore SSE']);
        eventSource.close();
      };
    } catch (error) {
      setSseStatus('error');
      setSseMessages(prev => [...prev, `❌ Errore: ${error}`]);
    }
  };

  // Disconnect functions
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const disconnectSSE = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
      setSseStatus('disconnected');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
      disconnectSSE();
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">Connesso</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500">Connessione...</Badge>;
      case 'error':
        return <Badge className="bg-red-500">Errore</Badge>;
      default:
        return <Badge variant="secondary">Disconnesso</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Test Realtime: WebSocket vs SSE</h1>
        <p className="text-muted-foreground">
          Test approfonditi di WebSocket e Server-Sent Events su Replit Autoscale
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* WebSocket Test */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>WebSocket Test</CardTitle>
              {getStatusBadge(wsStatus)}
            </div>
            <CardDescription>
              Test bidirezionale completo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Statistiche */}
              {wsStatus === 'connected' && (
                <div className="bg-muted p-3 rounded-lg">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Inviati</div>
                      <div className="font-semibold">{wsStats.sent}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Ricevuti</div>
                      <div className="font-semibold">{wsStats.received}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Ping</div>
                      <div className="font-semibold">{wsPing ? `${wsPing}ms` : '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Controlli */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={connectWebSocket} 
                  disabled={wsStatus === 'connected'}
                  variant={wsStatus === 'connected' ? 'secondary' : 'default'}
                  size="sm"
                >
                  Connetti
                </Button>
                <Button 
                  onClick={disconnectWebSocket} 
                  disabled={wsStatus === 'disconnected'}
                  variant="outline"
                  size="sm"
                >
                  Disconnetti
                </Button>
                <Button 
                  onClick={testPing} 
                  disabled={wsStatus !== 'connected'}
                  variant="outline"
                  size="sm"
                >
                  🏓 Test Ping
                </Button>
                <Button 
                  onClick={testVolume} 
                  disabled={wsStatus !== 'connected'}
                  variant="outline"
                  size="sm"
                >
                  📦 Test Volume
                </Button>
              </div>

              {/* Messaggio personalizzato */}
              {wsStatus === 'connected' && (
                <div className="flex gap-2">
                  <Input
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Scrivi un messaggio..."
                    onKeyPress={(e) => e.key === 'Enter' && sendCustomMessage()}
                  />
                  <Button onClick={sendCustomMessage} size="sm">
                    Invia
                  </Button>
                </div>
              )}

              {/* Log messaggi */}
              <div className="bg-muted p-4 rounded-lg h-64 overflow-y-auto">
                <div className="space-y-1">
                  {wsMessages.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nessun messaggio</p>
                  ) : (
                    wsMessages.slice(-20).map((msg, idx) => (
                      <p key={idx} className="text-sm font-mono">{msg}</p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SSE Test */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>SSE Test</CardTitle>
              {getStatusBadge(sseStatus)}
            </div>
            <CardDescription>
              Server-Sent Events (solo server → client)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={connectSSE} 
                  disabled={sseStatus === 'connected'}
                  variant={sseStatus === 'connected' ? 'secondary' : 'default'}
                >
                  Connetti
                </Button>
                <Button 
                  onClick={disconnectSSE} 
                  disabled={sseStatus === 'disconnected'}
                  variant="outline"
                >
                  Disconnetti
                </Button>
              </div>

              <div className="bg-muted p-4 rounded-lg h-64 overflow-y-auto">
                <div className="space-y-1">
                  {sseMessages.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nessun messaggio</p>
                  ) : (
                    sseMessages.slice(-20).map((msg, idx) => (
                      <p key={idx} className="text-sm font-mono">{msg}</p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Test Completati ✅</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">✅ Test WebSocket</h3>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
              <li><strong>Bidirezionalità:</strong> Invia messaggi personalizzati dal client al server</li>
              <li><strong>Latenza:</strong> Misura il ping in millisecondi (Test Ping)</li>
              <li><strong>Volume dati:</strong> Testa l'invio di 10KB in un singolo messaggio (Test Volume)</li>
              <li><strong>Heartbeat:</strong> Riceve messaggi automatici ogni secondo dal server</li>
              <li><strong>Statistiche:</strong> Conta messaggi inviati/ricevuti in tempo reale</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">🎯 Risultati</h3>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
              <li>Se vedi i messaggi heartbeat ogni secondo → <strong>WebSocket funziona</strong></li>
              <li>Se il ping è sotto 100ms → <strong>Latenza ottima per streaming</strong></li>
              <li>Se ricevi i 10KB senza errori → <strong>Può gestire streaming audio</strong></li>
              <li>Se puoi inviare messaggi e ricevere echo → <strong>Comunicazione bidirezionale OK</strong></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">📊 Conclusione</h3>
            <p className="text-sm text-muted-foreground">
              Se tutti i test passano, i WebSocket su Replit Autoscale sono <strong>perfettamente affidabili</strong> per:
              streaming audio TTS, chat in tempo reale, e comunicazione bidirezionale con l'AI.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
