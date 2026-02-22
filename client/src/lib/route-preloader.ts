import { queryClient } from './queryClient';

type PreloadFn = () => Promise<any>;

const CONSULTANT_CHUNK_MAP: Record<string, PreloadFn> = {
  '/consultant': () => import('@/pages/consultant-dashboard'),
  '/consultant/ai-assistant': () => import('@/pages/consultant-ai-assistant'),
  '/consultant/setup-wizard': () => import('@/pages/consultant-setup-wizard'),
  '/consultant/clients': () => import('@/pages/consultant-clients'),
  '/consultant/appointments': () => import('@/pages/consultant-appointments'),
  '/consultant/calendar': () => import('@/pages/consultant-calendar'),
  '/consultant/tasks': () => import('@/pages/consultant-tasks'),
  '/consultant/ai-config': () => import('@/pages/consultant-ai-config'),
  '/consultant/lead-hub': () => import('@/pages/consultant-lead-hub'),
  '/consultant/whatsapp': () => import('@/pages/consultant-whatsapp'),
  '/consultant/email-hub': () => import('@/pages/consultant-email-hub'),
  '/consultant/voice-calls': () => import('@/pages/consultant-voice-calls'),
  '/consultant/ai-autonomy': () => import('@/pages/consultant-ai-autonomy'),
  '/consultant/university': () => import('@/pages/consultant-university'),
  '/consultant/exercises': () => import('@/pages/consultant-exercises'),
  '/consultant/exercise-templates': () => import('@/pages/consultant-exercise-templates'),
  '/consultant/library': () => import('@/pages/consultant-library'),
  '/consultant/knowledge-documents': () => import('@/pages/consultant-knowledge-documents'),
  '/consultant/knowledge-apis': () => import('@/pages/consultant-knowledge-apis'),
  '/consultant/api-keys-unified': () => import('@/pages/consultant-api-keys-unified'),
  '/consultant/ai-consultations': () => import('@/pages/consultant-ai-consultations'),
  '/consultant/file-search-analytics': () => import('@/pages/consultant-file-search-analytics'),
  '/consultant/ai-usage': () => import('@/pages/consultant-ai-usage'),
  '/consultant/profile-settings': () => import('@/pages/consultant-profile-settings'),
  '/consultant/ai-settings': () => import('@/pages/consultant-ai-settings'),
  '/consultant/voice-settings': () => import('@/pages/consultant-voice-settings'),
  '/consultant/email-journey': () => import('@/pages/consultant-email-journey'),
  '/consultant/roadmap': () => import('@/pages/consultant-roadmap'),
};

const CLIENT_CHUNK_MAP: Record<string, PreloadFn> = {
  '/client': () => import('@/pages/client-dashboard'),
  '/client/ai-assistant': () => import('@/pages/client-ai-assistant'),
  '/client/university': () => import('@/pages/client-university'),
  '/client/exercises': () => import('@/pages/client-exercises'),
  '/client/library': () => import('@/pages/client-library'),
  '/client/calendar': () => import('@/pages/client-calendar'),
  '/client/roadmap': () => import('@/pages/client-roadmap'),
};

const QUERY_PREFETCH_MAP: Record<string, string[][]> = {
  '/consultant': [
    ['/api/clients'],
    ['/api/appointments/upcoming'],
    ['/api/stats/consultant'],
  ],
  '/consultant/clients': [
    ['/api/consultant/licenses'],
    ['/api/departments'],
  ],
  '/consultant/tasks': [
    ['/api/consultant-personal-tasks'],
  ],
  '/consultant/lead-hub': [
    ['/api/proactive-leads'],
    ['/api/campaigns'],
  ],
  '/consultant/ai-usage': [
    ['/api/ai-usage/summary'],
    ['/api/ai-usage/by-client'],
  ],
  '/consultant/whatsapp': [
    ['/api/whatsapp/config'],
  ],
  '/consultant/email-hub': [
    ['/api/email-hub/accounts'],
  ],
  '/consultant/appointments': [
    ['/api/consultant/calendar/status'],
  ],
};

const hoverTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const ALL_CHUNK_MAP = { ...CONSULTANT_CHUNK_MAP, ...CLIENT_CHUNK_MAP };

export function preloadOnHover(href: string) {
  if (hoverTimers[href]) return;
  hoverTimers[href] = setTimeout(() => {
    delete hoverTimers[href];
    ALL_CHUNK_MAP[href]?.().catch(() => {});
    const queries = QUERY_PREFETCH_MAP[href] ?? [];
    queries.forEach(queryKey => {
      queryClient.prefetchQuery({ queryKey, staleTime: Infinity }).catch(() => {});
    });
  }, 150);
}

export function cancelHoverPreload(href: string) {
  if (hoverTimers[href]) {
    clearTimeout(hoverTimers[href]);
    delete hoverTimers[href];
  }
}

export function preloadAfterLogin(role: 'consultant' | 'client') {
  setTimeout(() => {
    const chunkMap = role === 'consultant' ? CONSULTANT_CHUNK_MAP : CLIENT_CHUNK_MAP;
    Object.values(chunkMap).forEach(fn => fn().catch(() => {}));

    if (role === 'consultant') {
      Object.entries(QUERY_PREFETCH_MAP).forEach(([, queries]) => {
        queries.forEach(queryKey => {
          queryClient.prefetchQuery({ queryKey, staleTime: Infinity }).catch(() => {});
        });
      });
    }
  }, 1500);
}
