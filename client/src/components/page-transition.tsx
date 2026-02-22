import { useEffect, useState } from "react";
import { useBrandContext } from "@/contexts/BrandContext";
import { BookOpen } from "lucide-react";

const MESSAGES = [
  "Sincronizzazione dati in tempo reale...",
  "Caricamento intelligenza artificiale...",
  "Preparazione dashboard personalizzata...",
  "Analisi dei tuoi progressi...",
  "Ottimizzazione esperienza utente...",
  "Elaborazione contenuti intelligenti...",
  "Connessione ai servizi cloud...",
  "Quasi pronto per te...",
];

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  duration: Math.random() * 8 + 5,
  delay: Math.random() * 5,
  opacity: Math.random() * 0.4 + 0.1,
}));

const ORBS = Array.from({ length: 4 }, (_, i) => ({
  id: i,
  x: [15, 75, 25, 80][i],
  y: [20, 15, 75, 70][i],
  size: [300, 250, 280, 200][i],
  duration: [12, 16, 14, 18][i],
  delay: [0, 3, 6, 9][i],
}));

export function PageTransition() {
  const { brandPrimaryColor, brandSecondaryColor, brandLogoUrl, brandName } = useBrandContext();
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [messageFading, setMessageFading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const fadeIn = setTimeout(() => setVisible(true), 10);
    const t1 = setTimeout(() => setProgress(22), 150);
    const t2 = setTimeout(() => setProgress(45), 600);
    const t3 = setTimeout(() => setProgress(68), 1300);
    const t4 = setTimeout(() => setProgress(85), 2400);
    return () => {
      clearTimeout(fadeIn); clearTimeout(t1);
      clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
      setMessageFading(true);
      setTimeout(() => {
        setMessageIndex(i => (i + 1) % MESSAGES.length);
        setMessageFading(false);
      }, 350);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const p1 = brandPrimaryColor;
  const p2 = brandSecondaryColor;

  return (
    <div
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, #0a0f1e 0%, #0d1628 40%, #0f1a2e 70%, #0a1220 100%)`,
        }}
      />

      {ORBS.map(orb => (
        <div
          key={orb.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            transform: "translate(-50%, -50%)",
            background: orb.id % 2 === 0
              ? `radial-gradient(circle, ${p1}18 0%, transparent 70%)`
              : `radial-gradient(circle, ${p2}12 0%, transparent 70%)`,
            animation: `orb-float ${orb.duration}s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
          }}
        />
      ))}

      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.id % 3 === 0 ? p1 : p.id % 3 === 1 ? p2 : "#ffffff",
            opacity: p.opacity,
            animation: `particle-drift ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, ${p1}06 40px, ${p1}06 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, ${p1}06 40px, ${p1}06 41px)`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160">
            <defs>
              <linearGradient id="arcGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={p1} />
                <stop offset="100%" stopColor={p2} stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="arcGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={p2} />
                <stop offset="100%" stopColor={p1} stopOpacity="0.1" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx="80" cy="80" r="72" fill="none" stroke={`${p1}15`} strokeWidth="1" />
            <circle cx="80" cy="80" r="60" fill="none" stroke={`${p2}10`} strokeWidth="1" />

            <circle
              cx="80" cy="80" r="72"
              fill="none"
              stroke="url(#arcGrad1)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="280 173"
              filter="url(#glow)"
              style={{ animation: "spin-cw 2.2s linear infinite", transformOrigin: "80px 80px" }}
            />
            <circle
              cx="80" cy="80" r="60"
              fill="none"
              stroke="url(#arcGrad2)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="120 257"
              style={{ animation: "spin-ccw 3.5s linear infinite", transformOrigin: "80px 80px" }}
            />
            <circle
              cx="80" cy="80" r="48"
              fill="none"
              stroke={`${p1}30`}
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray="60 241"
              style={{ animation: "spin-cw 5s linear infinite", transformOrigin: "80px 80px" }}
            />

            <circle
              cx={80 + 72 * Math.cos(-Math.PI / 2)}
              cy={80 + 72 * Math.sin(-Math.PI / 2)}
              r="4" fill={p1} filter="url(#glow)"
              style={{ animation: "spin-cw 2.2s linear infinite", transformOrigin: "80px 80px" }}
            />
          </svg>

          <div
            className="relative flex items-center justify-center rounded-2xl"
            style={{
              width: 84,
              height: 84,
              background: `linear-gradient(135deg, ${p1}25, ${p2}35)`,
              border: `1px solid ${p1}40`,
              backdropFilter: "blur(10px)",
              boxShadow: `0 0 40px ${p1}30, 0 0 80px ${p1}15, inset 0 1px 0 ${p1}20`,
              transform: pulse ? "scale(1.05)" : "scale(1)",
              transition: "transform 0.3s ease",
            }}
          >
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${p1}20, transparent 60%)`,
              }}
            />
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt={brandName} className="w-12 h-12 object-contain relative z-10" />
            ) : (
              <BookOpen className="relative z-10" style={{ width: 36, height: 36, color: p1 }} />
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span
            className="text-xl font-bold tracking-widest uppercase"
            style={{
              color: "#ffffff",
              textShadow: `0 0 20px ${p1}80`,
              letterSpacing: "0.2em",
            }}
          >
            {brandName}
          </span>

          <div
            className="h-px w-32"
            style={{
              background: `linear-gradient(90deg, transparent, ${p1}, transparent)`,
              boxShadow: `0 0 8px ${p1}60`,
            }}
          />

          <div className="h-6 flex items-center justify-center">
            <span
              className="text-sm font-medium"
              style={{
                color: `${p1}cc`,
                opacity: messageFading ? 0 : 1,
                transform: messageFading ? "translateY(6px)" : "translateY(0)",
                transition: "opacity 0.35s ease, transform 0.35s ease",
              }}
            >
              {MESSAGES[messageIndex]}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2" style={{ width: 260 }}>
          <div
            className="relative overflow-hidden rounded-full"
            style={{
              width: 260,
              height: 3,
              background: `${p1}20`,
            }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${p2}, ${p1})`,
                boxShadow: `0 0 12px ${p1}`,
                transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            <div
              className="absolute top-0 h-full rounded-full"
              style={{
                width: 60,
                background: `linear-gradient(90deg, transparent, ${p1}80, transparent)`,
                animation: "shimmer-slide 2s ease-in-out infinite",
              }}
            />
          </div>

          <span
            className="text-xs font-mono"
            style={{ color: `${p1}60` }}
          >
            {progress}%
          </span>
        </div>

        <div className="flex gap-2 items-center">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? 8 : i === 1 || i === 3 ? 5 : 3,
                height: i === 2 ? 8 : i === 1 || i === 3 ? 5 : 3,
                backgroundColor: p1,
                animation: `wave-dot 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.12}s`,
                boxShadow: i === 2 ? `0 0 8px ${p1}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes orb-float {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          33% { transform: translate(-50%, -55%) scale(1.08); opacity: 0.8; }
          66% { transform: translate(-55%, -50%) scale(0.95); opacity: 0.5; }
        }
        @keyframes particle-drift {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.1; }
          25% { transform: translateY(-12px) translateX(6px); opacity: 0.4; }
          50% { transform: translateY(-6px) translateX(-8px); opacity: 0.2; }
          75% { transform: translateY(-18px) translateX(4px); opacity: 0.35; }
        }
        @keyframes shimmer-slide {
          0% { left: -80px; }
          100% { left: 280px; }
        }
        @keyframes wave-dot {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-6px) scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
