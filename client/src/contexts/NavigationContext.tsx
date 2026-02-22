import { createContext, useContext } from "react";

interface NavigationContextValue {
  navigate: (href: string) => void;
  isPending: boolean;
}

export const NavigationContext = createContext<NavigationContextValue>({
  navigate: (href) => { window.location.href = href; },
  isPending: false,
});

export function useNavigation() {
  return useContext(NavigationContext);
}
