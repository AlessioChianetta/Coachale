import { BookOpen } from "lucide-react";
import { useBrandContext } from "@/contexts/BrandContext";

export function PageLoader() {
  const { brandLogoUrl, brandName, brandPrimaryColor, brandSecondaryColor } = useBrandContext();

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-[hsl(222,18%,6%)] overflow-hidden">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 -left-20 w-72 h-72 rounded-full opacity-[0.07] dark:opacity-[0.04]"
          style={{
            background: `radial-gradient(circle, ${brandPrimaryColor}, transparent 70%)`,
            animation: 'loaderFloat 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-1/4 -right-16 w-80 h-80 rounded-full opacity-[0.06] dark:opacity-[0.03]"
          style={{
            background: `radial-gradient(circle, ${brandSecondaryColor}, transparent 70%)`,
            animation: 'loaderFloat 10s ease-in-out 2s infinite reverse',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-[0.04] dark:opacity-[0.02]"
          style={{
            background: 'radial-gradient(circle, #8b5cf6, transparent 70%)',
            animation: 'loaderFloat 12s ease-in-out 4s infinite',
          }}
        />

        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
              backgroundColor: `${brandPrimaryColor}1a`,
              animation: `loaderParticle ${3 + i * 0.7}s ease-in-out ${i * 0.5}s infinite`,
            }}
          />
        ))}

        <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="loader-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" className="text-slate-400 dark:text-slate-500" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loader-grid)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute w-24 h-24 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, transparent, ${brandPrimaryColor}, transparent)`,
              animation: 'loaderSpin 2s linear infinite',
              opacity: 0.15,
            }}
          />
          <div className="absolute w-20 h-20 rounded-full animate-ping" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: `${brandPrimaryColor}1a`, animationDuration: '2.5s' }} />
          <div
            className="relative p-4 rounded-2xl shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${brandPrimaryColor}, ${brandSecondaryColor})`, boxShadow: `0 25px 50px -12px ${brandPrimaryColor}40`, animation: 'loaderBreath 2s ease-in-out infinite' }}
          >
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt={brandName} className="h-7 w-7 rounded" />
            ) : (
              <BookOpen className="h-7 w-7 text-white" />
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? '8px' : '6px',
                height: i === 2 ? '8px' : '6px',
                background: `linear-gradient(135deg, ${brandPrimaryColor}, ${brandSecondaryColor})`,
                animation: `loaderWave 1.4s ease-in-out ${i * 0.12}s infinite`,
              }}
            />
          ))}
        </div>

        <p className="mt-4 text-sm font-medium text-slate-400 dark:text-slate-500 tracking-wide">
          Caricamento...
        </p>
      </div>

      <style>{`
        @keyframes loaderFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes loaderParticle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.8; }
        }
        @keyframes loaderSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes loaderBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes loaderWave {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-8px) scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
