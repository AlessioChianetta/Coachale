import { useEffect, useState } from "react";
import { useBrandContext } from "@/contexts/BrandContext";
import { BookOpen } from "lucide-react";

const MESSAGES = [
  "Caricamento dashboard...",
  "Sincronizzazione dati in tempo reale...",
  "Preparazione analisi AI...",
  "Ottimizzazione interfaccia...",
  "Recupero informazioni aggiornate...",
  "Elaborazione contenuti intelligenti...",
  "Quasi pronto...",
];

export function PageTransition() {
  const { brandPrimaryColor, brandSecondaryColor, brandLogoUrl, brandName } = useBrandContext();
  const [width, setWidth] = useState(8);
  const [messageIndex, setMessageIndex] = useState(0);
  const [messageFading, setMessageFading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fadeIn = setTimeout(() => setVisible(true), 10);
    const t1 = setTimeout(() => setWidth(30), 120);
    const t2 = setTimeout(() => setWidth(55), 500);
    const t3 = setTimeout(() => setWidth(72), 1100);
    const t4 = setTimeout(() => setWidth(88), 2000);
    return () => {
      clearTimeout(fadeIn);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageFading(true);
      setTimeout(() => {
        setMessageIndex(i => (i + 1) % MESSAGES.length);
        setMessageFading(false);
      }, 300);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm"
    >
      <div
        className="fixed top-0 left-0 h-[3px] rounded-r-full transition-all ease-out"
        style={{
          width: `${width}%`,
          transitionDuration: "600ms",
          background: `linear-gradient(90deg, ${brandPrimaryColor}, ${brandSecondaryColor})`,
          boxShadow: `0 0 12px ${brandPrimaryColor}90`,
        }}
      >
        <div
          className="absolute right-0 top-0 h-full w-24 rounded-r-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${brandPrimaryColor}ff)`,
            animation: "shimmer-pulse 1s ease-in-out infinite",
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-6 select-none">
        <div className="relative flex items-center justify-center w-28 h-28">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 112 112"
            style={{ animation: "spin-ring 1.8s linear infinite" }}
          >
            <circle
              cx="56"
              cy="56"
              r="50"
              fill="none"
              strokeWidth="3"
              stroke="url(#ringGrad)"
              strokeLinecap="round"
              strokeDasharray="200 115"
            />
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={brandPrimaryColor} />
                <stop offset="100%" stopColor={brandSecondaryColor} stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>

          <svg
            className="absolute inset-0 w-full h-full opacity-20"
            viewBox="0 0 112 112"
            style={{ animation: "spin-ring-reverse 3s linear infinite" }}
          >
            <circle
              cx="56"
              cy="56"
              r="44"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="80 200"
              stroke={brandSecondaryColor}
            />
          </svg>

          <div
            className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${brandPrimaryColor}18, ${brandSecondaryColor}28)`,
              animation: "breathe 2s ease-in-out infinite",
            }}
          >
            {brandLogoUrl ? (
              <img
                src={brandLogoUrl}
                alt={brandName}
                className="w-10 h-10 object-contain rounded-lg"
              />
            ) : (
              <BookOpen
                className="w-8 h-8"
                style={{ color: brandPrimaryColor }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span
            className="text-sm font-semibold tracking-wide"
            style={{ color: brandPrimaryColor }}
          >
            {brandName}
          </span>

          <div className="h-5 flex items-center justify-center">
            <span
              className="text-xs text-gray-400 transition-all duration-300"
              style={{
                opacity: messageFading ? 0 : 1,
                transform: messageFading ? "translateY(4px)" : "translateY(0)",
              }}
            >
              {MESSAGES[messageIndex]}
            </span>
          </div>
        </div>

        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: brandPrimaryColor,
                animation: `dot-bounce 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin-ring {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-ring-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes shimmer-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
