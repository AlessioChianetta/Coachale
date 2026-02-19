import { createContext, useContext, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders, getAuthUser, getToken } from "@/lib/auth";

interface BrandContextType {
  brandName: string;
  brandLogoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandFaviconUrl: string;
}

const defaultBrand: BrandContextType = {
  brandName: "Consulente Pro",
  brandLogoUrl: "",
  brandPrimaryColor: "#06b6d4",
  brandSecondaryColor: "#14b8a6",
  brandFaviconUrl: "",
};

const BrandContext = createContext<BrandContextType>(defaultBrand);

export function BrandProvider({ children }: { children: ReactNode }) {
  const token = getToken();
  const user = getAuthUser();
  const isConsultant = !!token && user?.role === "consultant";

  const { data: detailedProfile } = useQuery({
    queryKey: ["/api/consultant/detailed-profile"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/detailed-profile", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch detailed profile");
      return response.json();
    },
    enabled: isConsultant,
    staleTime: 5 * 60 * 1000,
  });

  const brand: BrandContextType = {
    brandName: detailedProfile?.brandName || defaultBrand.brandName,
    brandLogoUrl: detailedProfile?.brandLogoUrl || defaultBrand.brandLogoUrl,
    brandPrimaryColor: detailedProfile?.brandPrimaryColor || defaultBrand.brandPrimaryColor,
    brandSecondaryColor: detailedProfile?.brandSecondaryColor || defaultBrand.brandSecondaryColor,
    brandFaviconUrl: detailedProfile?.brandFaviconUrl || defaultBrand.brandFaviconUrl,
  };

  useEffect(() => {
    if (brand.brandFaviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = brand.brandFaviconUrl;
    }
  }, [brand.brandFaviconUrl]);

  return (
    <BrandContext.Provider value={brand}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrandContext() {
  return useContext(BrandContext);
}
