import { useBrandContext } from "@/contexts/BrandContext";
import { BookOpen } from "lucide-react";

export function NavigationOverlay() {
  const { brandLogoUrl, brandName, brandPrimaryColor, brandSecondaryColor } = useBrandContext();

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-md"
      style={{ animation: "navOverlayFadeIn 0.15s ease-out" }}
    >
      <div className="relative flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute w-20 h-20 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, transparent, ${brandPrimaryColor}, transparent)`,
              animation: 'loaderSpin 2s linear infinite',
              opacity: 0.15,
            }}
          />
          <div
            className="absolute w-16 h-16 rounded-full animate-ping"
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: `${brandPrimaryColor}1a`,
              animationDuration: '2.5s',
            }}
          />
          <div
            className="relative p-4 rounded-2xl shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${brandPrimaryColor}, ${brandSecondaryColor})`,
              boxShadow: `0 20px 40px -12px ${brandPrimaryColor}40`,
              animation: 'loaderBreath 2s ease-in-out infinite',
            }}
          >
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt={brandName} className="h-7 w-7 rounded" />
            ) : (
              <BookOpen className="h-7 w-7 text-white" />
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
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
      </div>

      <style>{`
        @keyframes navOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
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
