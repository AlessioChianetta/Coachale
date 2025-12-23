import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AlessiaSessionState {
  isActive: boolean;
  isMinimized: boolean;
  position: { x: number; y: number };
  voiceName: string;
  sessionStartTime: number | null;
}

interface AlessiaSessionContextType {
  session: AlessiaSessionState;
  startSession: () => void;
  endSession: () => void;
  minimizeSession: () => void;
  maximizeSession: () => void;
  updatePosition: (x: number, y: number) => void;
  setVoiceName: (voice: string) => void;
}

const getDefaultPosition = () => {
  if (typeof window !== 'undefined') {
    return { x: window.innerWidth - 420, y: window.innerHeight - 520 };
  }
  return { x: 0, y: 0 };
};

const defaultState: AlessiaSessionState = {
  isActive: false,
  isMinimized: false,
  position: getDefaultPosition(),
  voiceName: 'Archernar',
  sessionStartTime: null,
};

const AlessiaSessionContext = createContext<AlessiaSessionContextType | undefined>(undefined);

export function AlessiaSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AlessiaSessionState>(() => {
    const savedVoice = typeof window !== 'undefined' ? localStorage.getItem('alessia_voice') : null;
    return {
      ...defaultState,
      position: getDefaultPosition(),
      voiceName: savedVoice || 'Archernar',
    };
  });

  const startSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      isActive: true,
      isMinimized: false,
      sessionStartTime: Date.now(),
    }));
  }, []);

  const endSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      isActive: false,
      isMinimized: false,
      sessionStartTime: null,
    }));
  }, []);

  const minimizeSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      isMinimized: true,
    }));
  }, []);

  const maximizeSession = useCallback(() => {
    setSession(prev => ({
      ...prev,
      isMinimized: false,
    }));
  }, []);

  const updatePosition = useCallback((x: number, y: number) => {
    setSession(prev => ({
      ...prev,
      position: { x, y },
    }));
  }, []);

  const setVoiceName = useCallback((voice: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alessia_voice', voice);
    }
    setSession(prev => ({
      ...prev,
      voiceName: voice,
    }));
  }, []);

  return (
    <AlessiaSessionContext.Provider
      value={{
        session,
        startSession,
        endSession,
        minimizeSession,
        maximizeSession,
        updatePosition,
        setVoiceName,
      }}
    >
      {children}
    </AlessiaSessionContext.Provider>
  );
}

export function useAlessiaSession() {
  const context = useContext(AlessiaSessionContext);
  if (context === undefined) {
    throw new Error('useAlessiaSession must be used within an AlessiaSessionProvider');
  }
  return context;
}
