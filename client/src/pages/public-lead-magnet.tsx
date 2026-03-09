import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useLocation } from 'wouter';
import { setToken, setAuthUser } from '@/lib/auth';

type Phase = 'landing' | 'chat' | 'report';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface SessionData {
  token: string;
  sessionId: string;
  leadName: string;
}

function LandingSection({ onStart, consultantId }: { onStart: (data: SessionData, authToken?: string, user?: any) => void; consultantId?: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/public/lead-magnet/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), password, consultantId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Errore');
      onStart({ token: data.data.token, sessionId: data.data.sessionId, leadName: name.trim() }, data.data.authToken, data.data.user);
    } catch (err: any) {
      setError(err.message || 'Si è verificato un errore. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', color: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <header style={{ width: '100%', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', color: '#fff' }}>SO</div>
        <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em' }}>Sistema Orbitale</span>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px', maxWidth: '680px', width: '100%', gap: '40px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '13px', fontWeight: 500, color: '#34d399', marginBottom: '20px' }}>
            Analisi Gratuita in 5 Minuti
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
            Scopri Come l'AI Può <span style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Trasformare</span> la Tua Azienda
          </h1>
          <p style={{ fontSize: '17px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
            Parlerai con Luca, il nostro consulente AI specializzato. Ti farà alcune domande sul tuo business e genererà un report personalizzato con le soluzioni AI più adatte alla tua attività.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%' }}>
          {[
            { num: '1', title: 'Rispondi', desc: 'Qualche domanda sul tuo business' },
            { num: '2', title: 'Analisi AI', desc: 'L\'AI analizza i tuoi processi' },
            { num: '3', title: 'Report', desc: 'Ricevi il piano personalizzato' },
          ].map((s) => (
            <div key={s.num} style={{ textAlign: 'center', padding: '16px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', margin: '0 auto 8px' }}>{s.num}</div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{s.title}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.06)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <input
            type="text" required value={name} onChange={e => setName(e.target.value)}
            placeholder="Il tuo nome e cognome"
            style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#f8fafc', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="La tua email"
            style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#f8fafc', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Il tuo numero di telefono"
            style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#f8fafc', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Scegli una password (min. 6 caratteri)"
            minLength={6}
            style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#f8fafc', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
          />
          {error && <div style={{ color: '#f87171', fontSize: '14px', textAlign: 'center' }}>{error}</div>}
          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '16px', borderRadius: '10px', border: 'none', background: loading ? '#374151' : 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', letterSpacing: '-0.01em' }}
          >
            {loading ? 'Avvio in corso...' : 'Inizia la Tua Analisi Gratuita'}
          </button>
          <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', margin: 0 }}>
            Nessun costo. Nessun impegno. I tuoi dati sono al sicuro.
          </p>
        </form>
      </main>

      <footer style={{ padding: '20px 24px', fontSize: '13px', color: '#475569', textAlign: 'center' }}>
        Sistema Orbitale — Dipendenti AI per la Tua Azienda
      </footer>
    </div>
  );
}

function ChatSection({ session, onReportReady }: { session: SessionData; onReportReady: (report: any) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [discoveryComplete, setDiscoveryComplete] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const initChat = async () => {
      try {
        const res = await fetch(`/api/public/lead-magnet/${session.token}/session`);
        const data = await res.json();
        if (data.success && data.data.messages?.length > 0) {
          setMessages(data.data.messages.map((m: any) => ({
            id: m.id || crypto.randomUUID(),
            role: m.role,
            content: m.content,
          })));
          if (data.data.session.status === 'elaborating') {
            setDiscoveryComplete(true);
          }
          setInitialLoading(false);
          return;
        }
      } catch {}

      setInitialLoading(false);
      await sendMessage('Ciao, sono pronto per l\'analisi!', true);
    };
    initChat();
  }, []);

  const sendMessage = async (text: string, isInit = false) => {
    if (streaming) return;

    if (!isInit) {
      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
      setMessages(prev => [...prev, userMsg]);
    }
    setInput('');
    setStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const res = await fetch(`/api/public/lead-magnet/${session.token}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'delta') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + evt.content } : m
              ));
            } else if (evt.type === 'phase_change' && evt.phase === 'elaborating') {
              setDiscoveryComplete(true);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => prev.map(m =>
        m.id === assistantId && !m.content ? { ...m, content: 'Si è verificato un errore. Riprova.' } : m
      ));
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    sendMessage(input.trim());
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/public/lead-magnet/${session.token}/generate-report`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onReportReady(data.data.report);
      }
    } catch (err) {
      console.error('Report error:', err);
    } finally {
      setGeneratingReport(false);
    }
  };

  const cleanContent = (text: string) => {
    return text
      .replace(/\[DISCOVERY_COMPLETE\]/g, '')
      .replace(/```json[\s\S]*?```/g, '')
      .trim();
  };

  if (initialLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(16, 185, 129, 0.3)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          Connessione con Luca...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', color: '#f8fafc' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15, 23, 42, 0.95)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>L</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>Luca — Consulente AI</div>
          <div style={{ fontSize: '12px', color: streaming ? '#10b981' : '#64748b' }}>
            {streaming ? 'Sta scrivendo...' : 'Online'}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg) => {
          const cleaned = msg.role === 'assistant' ? cleanContent(msg.content) : msg.content;
          if (!cleaned) return null;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
              <div style={{
                maxWidth: 'min(85%, 520px)',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'rgba(255, 255, 255, 0.08)',
                fontSize: '15px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {cleaned}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {discoveryComplete && !generatingReport ? (
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 12px' }}>L'analisi è completa. Genera il tuo report personalizzato.</p>
          <button
            onClick={generateReport}
            style={{ padding: '14px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
          >
            Genera il Tuo Report
          </button>
        </div>
      ) : generatingReport ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(16, 185, 129, 0.3)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ margin: 0, fontSize: '15px' }}>Stiamo analizzando il tuo business e generando il report...</p>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b' }}>Potrebbe richiedere fino a 60 secondi</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.95)', position: 'sticky', bottom: 0 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Scrivi il tuo messaggio..."
            disabled={streaming}
            autoFocus
            style={{ flex: 1, padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#f8fafc', fontSize: '15px', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            style={{ padding: '14px 20px', borderRadius: '10px', border: 'none', background: (!input.trim() || streaming) ? '#374151' : 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: (!input.trim() || streaming) ? 'not-allowed' : 'pointer' }}
          >
            Invia
          </button>
        </form>
      )}
    </div>
  );
}

function ReportSection({ report, leadName }: { report: any; leadName: string }) {
  const lettera = report.lettera_personale || '';
  const diagnosi = report.diagnosi || {};
  const pacchetti = report.pacchetti_consigliati || [];
  const roadmap = report.roadmap || [];
  const quickWins = report.quick_wins || [];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px' }}>SO</div>
        <span style={{ fontSize: '18px', fontWeight: 600 }}>Il Tuo Report Personalizzato</span>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        {lettera && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', background: 'linear-gradient(135deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Lettera Personale
            </h2>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', fontSize: '15px', lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>
              {typeof lettera === 'string' ? lettera : JSON.stringify(lettera)}
            </div>
          </section>
        )}

        {diagnosi && (diagnosi.dove_sei_ora || diagnosi.gap_analysis) && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', color: '#f8fafc' }}>Diagnosi</h2>
            {diagnosi.dove_sei_ora && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#10b981', margin: '0 0 8px' }}>Dove Sei Ora</h3>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.7, color: '#94a3b8' }}>{diagnosi.dove_sei_ora}</p>
              </div>
            )}
            {diagnosi.gap_analysis && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f59e0b', margin: '0 0 8px' }}>Gap Analysis</h3>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.7, color: '#94a3b8' }}>{diagnosi.gap_analysis}</p>
              </div>
            )}
          </section>
        )}

        {pacchetti.length > 0 && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', color: '#f8fafc' }}>Soluzioni AI Consigliate</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pacchetti.map((pkg: any, i: number) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                      {pkg.nome || pkg.titolo || `Pacchetto ${i + 1}`}
                    </h3>
                    {pkg.priorita && (
                      <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: pkg.priorita === 'Fondamenta' ? 'rgba(16,185,129,0.2)' : pkg.priorita === 'Core' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)', color: pkg.priorita === 'Fondamenta' ? '#34d399' : pkg.priorita === 'Core' ? '#60a5fa' : '#a78bfa' }}>
                        {pkg.priorita}
                      </span>
                    )}
                  </div>
                  {pkg.perche_per_te && <p style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: 1.6, color: '#94a3b8' }}>{pkg.perche_per_te}</p>}
                  {pkg.primo_passo && (
                    <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', fontSize: '13px', color: '#34d399' }}>
                      Primo passo: {pkg.primo_passo}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {roadmap.length > 0 && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', color: '#f8fafc' }}>Roadmap</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {roadmap.map((phase: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{phase.titolo || phase.fase || `Fase ${i + 1}`}</div>
                    {phase.periodo && <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '8px' }}>{phase.periodo}</div>}
                    {phase.azioni && Array.isArray(phase.azioni) && (
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.7 }}>
                        {phase.azioni.map((a: string, j: number) => <li key={j}>{a}</li>)}
                      </ul>
                    )}
                    {phase.vita_dopo && <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>{phase.vita_dopo}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {quickWins.length > 0 && (
          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', color: '#f8fafc' }}>Quick Wins — Azioni Immediate</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {quickWins.map((qw: any, i: number) => (
                <div key={i} style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#fbbf24', marginBottom: '4px' }}>{qw.titolo || qw.azione || `Quick Win ${i + 1}`}</div>
                  {qw.descrizione && <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>{qw.descrizione}</p>}
                  {qw.tempo && <span style={{ display: 'inline-block', marginTop: '8px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', fontSize: '11px', color: '#fbbf24' }}>{qw.tempo}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.15))', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Vuoi Implementare Queste Soluzioni?
          </h2>
          <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.6 }}>
            Prenota una consulenza gratuita con Alessio per discutere il tuo piano personalizzato e attivare le soluzioni AI per la tua azienda.
          </p>
          <a
            href="https://sistemaorbitale.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', padding: '16px 40px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#fff', fontSize: '16px', fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.01em' }}
          >
            Prenota Consulenza Gratuita
          </a>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '16px 0 0' }}>
            Nessun costo. Nessun impegno.
          </p>
        </section>

        <footer style={{ padding: '32px 0', textAlign: 'center', fontSize: '13px', color: '#475569' }}>
          Report generato da Sistema Orbitale — Dipendenti AI per la Tua Azienda
        </footer>
      </div>
    </div>
  );
}

export default function PublicLeadMagnet() {
  const params = useParams<{ consultantId?: string }>();
  const consultantId = params.consultantId || undefined;
  const [phase, setPhase] = useState<Phase>('landing');
  const [session, setSession] = useState<SessionData | null>(null);
  const [report, setReport] = useState<any>(null);

  const [, setLocation] = useLocation();

  const handleStart = (data: SessionData, authToken?: string, user?: any) => {
    if (authToken && user) {
      setToken(authToken);
      setAuthUser(user);
      setLocation('/lead/chat');
      return;
    }
    setSession(data);
    setPhase('chat');
  };

  const handleReport = (reportData: any) => {
    setReport(reportData);
    setPhase('report');
  };

  if (phase === 'landing') {
    return <LandingSection onStart={handleStart} consultantId={consultantId} />;
  }

  if (phase === 'chat' && session) {
    return <ChatSection session={session} onReportReady={handleReport} />;
  }

  if (phase === 'report' && report && session) {
    return <ReportSection report={report} leadName={session.leadName} />;
  }

  return <LandingSection onStart={handleStart} />;
}
