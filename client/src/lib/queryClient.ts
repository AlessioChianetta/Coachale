import { QueryClient, QueryCache, MutationCache, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const json = await res.json();
      throw new Error(`${res.status}: ${json.message || res.statusText}`);
    } catch (e) {
      // Se il parsing JSON fallisce, usa il testo
      const text = res.statusText || 'Request failed';
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

export const apiRequest = async (method: string, url: string, data?: any) => {
  const token = localStorage.getItem('token');

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('token');
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// --- NUOVA PARTE AGGIUNTA ---

// Funzione centralizzata per gestire il logout
const handleLogout = () => {
  // 1. Rimuovi il token dalla memoria locale del browser
  localStorage.removeItem('token');

  // 2. Reindirizza l'utente alla pagina di login.
  // Usiamo un hard redirect (window.location.href) per essere sicuri
  // di cancellare tutto lo stato dell'applicazione e ricominciare da capo.
  window.location.href = '/login'; 
};

// --- CONFIGURAZIONE MODIFICATA ---

export const queryClient = new QueryClient({
  // Aggiungiamo un gestore di errori globale per tutte le QUERY (useQuery)
  queryCache: new QueryCache({
    onError: (error) => {
      // Controlliamo se il messaggio di errore contiene "401" o "403"
      // per gestire sia Unauthorized che Forbidden (token scaduto)
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('403') ||
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('invalid or expired token')
      )) {
        console.log('Auth error detected, logging out:', error.message);
        handleLogout();
      }
    },
  }),
  // Aggiungiamo un gestore di errori globale per tutte le MUTAZIONI (useMutation)
  mutationCache: new MutationCache({
    onError: (error) => {
      // Applichiamo la stessa logica di controllo dell'errore.
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('403') ||
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('invalid or expired token')
      )) {
        console.log('Auth error detected in mutation, logging out:', error.message);
        handleLogout();
      }
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});