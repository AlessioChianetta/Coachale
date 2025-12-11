import { useState, useEffect, useCallback } from 'react';

export interface FocusedDocument {
  id: string;
  title: string;
  content?: string;
  category?: string;
  fileName?: string;
}

const STORAGE_KEY = 'ai_focused_document';

export function useDocumentFocus() {
  const [focusedDocument, setFocusedDocument] = useState<FocusedDocument | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setFocusedDocument(JSON.parse(stored));
      } catch (e) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }

    const handleFocusEvent = (event: CustomEvent<FocusedDocument>) => {
      setFocusedDocument(event.detail);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(event.detail));
    };

    const handleClearEvent = () => {
      setFocusedDocument(null);
      sessionStorage.removeItem(STORAGE_KEY);
    };

    window.addEventListener('ai:focus-document', handleFocusEvent as EventListener);
    window.addEventListener('ai:clear-document-focus', handleClearEvent);

    return () => {
      window.removeEventListener('ai:focus-document', handleFocusEvent as EventListener);
      window.removeEventListener('ai:clear-document-focus', handleClearEvent);
    };
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedDocument(null);
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('ai:clear-document-focus'));
  }, []);

  return { focusedDocument, clearFocus };
}

export function focusOnDocument(document: FocusedDocument) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  window.dispatchEvent(new CustomEvent('ai:focus-document', { detail: document }));
}

export function clearDocumentFocus() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('ai:clear-document-focus'));
}
