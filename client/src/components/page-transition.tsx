import { useEffect, useState } from "react";
import { useBrandContext } from "@/contexts/BrandContext";

export function PageTransition() {
  const { brandPrimaryColor } = useBrandContext();
  const [width, setWidth] = useState(15);

  useEffect(() => {
    const t1 = setTimeout(() => setWidth(40), 100);
    const t2 = setTimeout(() => setWidth(65), 400);
    const t3 = setTimeout(() => setWidth(85), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[3px] transition-all duration-500 ease-out rounded-r-full"
      style={{
        width: `${width}%`,
        background: `linear-gradient(90deg, ${brandPrimaryColor}, ${brandPrimaryColor}cc)`,
        boxShadow: `0 0 8px ${brandPrimaryColor}80`,
      }}
    />
  );
}
