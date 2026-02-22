import { createContext, useContext } from "react";

interface NavigationContextValue {
  navigate: (href: string) => void;
  isPending: boolean;
  setNavigating: (v: boolean) => void;
}

export const NavigationContext = createContext<NavigationContextValue>({
  navigate: (href) => { window.location.href = href; },
  isPending: false,
  setNavigating: () => {},
});

export function useNavigation() {
  return useContext(NavigationContext);
}
