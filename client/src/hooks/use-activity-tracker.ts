import { useEffect, useRef } from 'react';

let sessionId: string | null = null;

interface UseActivityTrackerOptions {
  disabled?: boolean;
}

export function useActivityTracker(options: UseActivityTrackerOptions = {}) {
  const { disabled = false } = options;
  const isTracking = useRef(false);

  useEffect(() => {
    // Skip if disabled (e.g., on public pages or when not authenticated)
    if (disabled) {
      return;
    }
    
    // Check if this specific component instance is already tracking
    if (isTracking.current) return;
    isTracking.current = true;

    // Check if this is a fresh login
    const isLoginSuccess = localStorage.getItem('loginSuccess');
    
    // Get user-specific session ID
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userSessionKey = user.id ? `sessionId_${user.id}` : 'sessionId';
    const existingSessionId = localStorage.getItem(userSessionKey);
    
    console.log('Activity tracker init:', { isLoginSuccess, existingSessionId, sessionId, userId: user.id });
    
    if (isLoginSuccess === 'true') {
      // Clear the login flag and start fresh session
      localStorage.removeItem('loginSuccess');
      
      // Clear user-specific session
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userSessionKey = user.id ? `sessionId_${user.id}` : 'sessionId';
      localStorage.removeItem(userSessionKey);
      localStorage.removeItem('sessionId'); // Clear generic session too
      sessionId = null;
      
      console.log('Fresh login detected, starting new session');
      
      // Add small delay to ensure DOM is ready
      setTimeout(() => {
        startSession();
      }, 100);
    } else if (existingSessionId && !sessionId) {
      // Restore existing session
      sessionId = existingSessionId;
      console.log('✅ Restoring existing session:', existingSessionId);
    } else if (!sessionId) {
      // Start session only if we don't have one
      console.log('No existing session, starting new one');
      startSession();
    }

    // Also check for loginSuccess flag continuously to catch delayed logins
    const checkLoginSuccess = () => {
      const loginFlag = localStorage.getItem('loginSuccess');
      if (loginFlag === 'true' && !sessionId) {
        console.log('Delayed login success detected');
        localStorage.removeItem('loginSuccess');
        
        // Clear user-specific session
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userSessionKey = user.id ? `sessionId_${user.id}` : 'sessionId';
        localStorage.removeItem(userSessionKey);
        localStorage.removeItem('sessionId');
        sessionId = null;
        setTimeout(() => {
          startSession();
        }, 100);
      }
    };

    // Check every 500ms for login success for the first 5 seconds
    const intervalId = setInterval(checkLoginSuccess, 500);
    setTimeout(() => clearInterval(intervalId), 5000);

    // Start heartbeat interval (every 3 minutes)
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && sessionId) {
        sendHeartbeat();
      }
    }, 3 * 60 * 1000); // 3 minutes

    // Send initial heartbeat after a short delay
    setTimeout(() => {
      if (document.visibilityState === 'visible' && sessionId) {
        sendHeartbeat();
      }
    }, 30000); // 30 seconds

    // Track page visibility changes - only send heartbeat, no activity logging
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionId) {
        sendHeartbeat();
      }
    };

    // Track session end on page unload only if user is actually logging out
    const handleBeforeUnload = () => {
      // Only end session if user is actually logging out (not just refreshing)
      const isLogout = localStorage.getItem('isLoggingOut');
      if (isLogout === 'true') {
        endSession();
        localStorage.removeItem('isLoggingOut');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Don't end session on component unmount, only on page unload
      isTracking.current = false;
    };
  }, [disabled]);

  const startSession = async (retryCount = 0) => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      console.log('🔄 Starting session attempt', retryCount + 1, '- token exists:', !!token, '- user ID:', user.id);
      
      // Retry logic: if no token/user, wait and retry up to 5 times
      if ((!token || !user.id) && retryCount < 5) {
        console.log('⏳ Token/user not ready, retrying in', (retryCount + 1) * 500, 'ms...');
        setTimeout(() => {
          startSession(retryCount + 1);
        }, (retryCount + 1) * 500); // Exponential backoff: 500ms, 1000ms, 1500ms, etc
        return;
      }
      
      if (!token) {
        console.error('❌ No token found after retries, cannot start session');
        return;
      }
      
      if (!user.id) {
        console.error('❌ No user ID found after retries, cannot start session');
        return;
      }

      // Check if we already have an active session for this user
      const userSessionKey = `sessionId_${user.id}`;
      const existingSessionId = localStorage.getItem(userSessionKey);
      if (existingSessionId && sessionId === existingSessionId) {
        console.log('Session already active, skipping');
        return; // Session already active
      }

      console.log('Making request to start session...');
      const response = await fetch('/api/activity/session/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Session start response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        sessionId = data.sessionId;
        
        // Store session with user-specific key
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userSessionKey = `sessionId_${user.id}`;
        localStorage.setItem(userSessionKey, sessionId);
        localStorage.setItem('sessionId', sessionId); // Keep for backward compatibility
        
        console.log('✅ Session started successfully:', sessionId);
      } else {
        const errorText = await response.text();
        console.error('Failed to start session - status:', response.status, 'response:', errorText);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const endSession = async () => {
    if (!sessionId) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/activity/session/end', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const sendHeartbeat = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, skipping heartbeat');
        return;
      }

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userSessionKey = user.id ? `sessionId_${user.id}` : 'sessionId';
      const currentSessionId = sessionId || localStorage.getItem(userSessionKey);

      if (!currentSessionId) {
        console.log('No session ID, skipping heartbeat');
        return;
      }

      await fetch('/api/activity/session/heartbeat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: currentSessionId }),
      });

      console.log('Heartbeat sent successfully');
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  };

  const logActivity = async (activityType: string, details?: any) => {
    // ACTIVITY LOGGING DISABLED - Only heartbeat for online/offline status
    // Manteniamo solo il sistema heartbeat per determinare se un utente è online o offline
    return;
  };

  const logExerciseStart = (exerciseId: string, exerciseTitle: string) => {
    logActivity('exercise_start', { exerciseId, exerciseTitle });
  };

  const logExerciseView = (exerciseId: string, exerciseTitle: string) => {
    logActivity('exercise_view', { exerciseId, exerciseTitle });
  };

  const logPageView = (page: string) => {
    logActivity('page_view', { page });
  };

  return {
    logActivity,
    logExerciseStart,
    logExerciseView,
    logPageView,
  };
}