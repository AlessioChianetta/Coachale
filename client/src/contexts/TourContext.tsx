import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import confetti from 'canvas-confetti';
import { driverConfig } from '@/lib/tour/driver-config';
import { clientTourSteps } from '@/components/interactive-tour/client-tour-steps';

interface TourContextType {
  startTour: () => void;
  isTourActive: boolean;
  hasCompletedTour: boolean;
  markTourComplete: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [isTourActive, setIsTourActive] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState<boolean>(() => {
    const saved = localStorage.getItem('tour-completed-client');
    return saved === 'true';
  });

  // ⬇️ -----------------------------------------------------------------
  // ⚠️ MODIFICA QUI: Inserisci la durata della tua animazione CSS
  // (es. se la tua animazione è 'transition: 300ms', imposta 350)
  const ANIMATION_DURATION = 400; // (Durata animazione + 50ms di buffer)
  // ⬆️ -----------------------------------------------------------------


  const markTourComplete = useCallback(() => {
    setHasCompletedTour(true);
    localStorage.setItem('tour-completed-client', 'true');
    localStorage.setItem('tour-completed-date-client', new Date().toISOString());
  }, []);

  const startTour = useCallback(() => {
    setIsTourActive(true);
    let currentStepIndex = 0;
    let didCompleteSuccessfully = false;

    let driverObj: any;
    driverObj = driver({
      ...driverConfig,
      disableActiveInteraction: false,

      // --- 🚀 NUOVA LOGICA ASINCRONA ---

      onNextClick: async (element, step, options) => {
        const currentStepEl = step.element; // L'elemento dello step CORRENTE
        
        console.log('🔵 onNextClick triggered', {
          currentIndex: options.state.activeIndex,
          stepElement: currentStepEl,
          stepTitle: step.popover?.title
        });

        // Identifica se questo step richiede animazioni
        const needsAnimation = 
          currentStepEl === '[data-tour="client-la-mia-universita"]' ||
          currentStepEl === '[data-tour="client-submenu-corsi"]' ||
          currentStepEl === '[data-tour="client-submenu-consulenze"]';

        if (!needsAnimation) {
          // Per step senza animazioni, avanza immediatamente
          console.log('⏩ No animation needed - advancing to next step');
          driverObj.moveNext();
          return;
        }

        // Solo per step con animazioni, esegui la logica personalizzata
        
        // Transizione: Da "La Mia Università" card -> submenu
        if (currentStepEl === '[data-tour="client-la-mia-universita"]') {
          console.log('🟢 Expanding La Mia Università menu');
          window.dispatchEvent(new CustomEvent('tour-expand-menu', {
            detail: { menuName: 'La Mia Università' }
          }));

          await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION));
          
          const targetElement = document.querySelector('[data-tour="client-la-mia-universita-submenu"]');
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Transizione: Da "Università" -> "Il Mio Tempo"
        if (currentStepEl === '[data-tour="client-submenu-corsi"]') {
          console.log('🟡 Transitioning from Università to Il Mio Tempo');
          window.dispatchEvent(new CustomEvent('tour-collapse-menu', {
            detail: { menuName: 'La Mia Università' }
          }));
          window.dispatchEvent(new CustomEvent('tour-expand-menu', {
            detail: { menuName: 'Il Mio Tempo' }
          }));

          await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION));
          
          const targetElement = document.querySelector('[data-tour="client-il-mio-tempo"]');
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Transizione: Da "Il Mio Tempo" -> "Gestione Finanziaria"
        if (currentStepEl === '[data-tour="client-submenu-consulenze"]') {
          console.log('🟣 Transitioning from Il Mio Tempo to Gestione Finanziaria');
          window.dispatchEvent(new CustomEvent('tour-collapse-menu', {
            detail: { menuName: 'Il Mio Tempo' }
          }));

          await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION));
        }

        console.log('✅ Animation completed - advancing to next step');
        driverObj.moveNext();
      },

      onPrevClick: async (element, step, options) => {
        const currentStepEl = step.element;

        // Identifica se questo step richiede animazioni per tornare indietro
        const needsAnimation = 
          currentStepEl === '[data-tour="client-la-mia-universita-submenu"]' ||
          currentStepEl === '[data-tour="client-il-mio-tempo"]' ||
          currentStepEl === '[data-testid="link-gestione-finanziaria"]';

        if (!needsAnimation) {
          // Per step senza animazioni, torna indietro immediatamente
          driverObj.movePrevious();
          return;
        }

        // Transizione (indietro): Dal submenu Università -> card principale
        if (currentStepEl === '[data-tour="client-la-mia-universita-submenu"]') {
          window.dispatchEvent(new CustomEvent('tour-collapse-menu', {
            detail: { menuName: 'La Mia Università' }
          }));

          await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION));
          
          const targetElement = document.querySelector('[data-tour="client-la-mia-universita"]');
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Transizione (indietro): Da "Il Mio Tempo" -> "Università"
        if (currentStepEl === '[data-tour="client-il-mio-tempo"]') {
          window.dispatchEvent(new CustomEvent('tour-collapse-menu', {
            detail: { menuName: 'Il Mio Tempo' }
          }));
          window.dispatchEvent(new CustomEvent('tour-expand-menu', {
            detail: { menuName: 'La Mia Università' }
          }));

          await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION));
          
          const targetElement = document.querySelector('[data-tour="client-submenu-corsi"]');
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Transizione (indietro): Da "Gestione Finanziaria" -> "Il Mio Tempo"
        if (currentStepEl === '[data-testid="link-gestione-finanziaria"]') {
          window.dispatchEvent(new CustomEvent('tour-expand-menu', {
            detail: { menuName: 'Il Mio Tempo' }
          }));

          await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION));
          
          const targetElement = document.querySelector('[data-tour="client-submenu-consulenze"]');
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        driverObj.movePrevious();
      },

      // --- LOGICA DI EVIDENZIAZIONE SEMPLIFICATA ---

      onHighlightStarted: (element, step, options) => {
        currentStepIndex = options.state.activeIndex || 0;
        
        console.log('🟢 onHighlightStarted', {
          currentIndex: currentStepIndex,
          stepElement: step.element,
          stepTitle: step.popover?.title
        });

        // Marca come completato solo all'ultimo step
        if (currentStepIndex === clientTourSteps.length - 1) {
          didCompleteSuccessfully = true;
        }

        // Scroll automatico generico per garantire visibilità di TUTTI gli step
        setTimeout(() => {
          if (element instanceof HTMLElement) {
            const rect = element.getBoundingClientRect();
            const isVisible = (
              rect.top >= 0 &&
              rect.left >= 0 &&
              rect.bottom <= window.innerHeight &&
              rect.right <= window.innerWidth
            );
            
            // Scroll solo se non è completamente visibile
            if (!isVisible) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
          }
        }, 150);

        // Call original onHighlightStarted if exists
        if (driverConfig.onHighlightStarted) {
          driverConfig.onHighlightStarted(element, step, options);
        }
      },

      onDestroyed: () => {
        setIsTourActive(false);

        // Only mark as complete if user reached the final step
        if (didCompleteSuccessfully) {
          markTourComplete();

          // Celebrazione finale con confetti!
          const duration = 3000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

          const interval: any = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
              colors: ['#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#10b981']
            });

            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
              colors: ['#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#10b981']
            });
          }, 250);
        }
      },
    });

    driverObj.setSteps(clientTourSteps);
    driverObj.drive();
  }, [markTourComplete]);

  return (
    <TourContext.Provider value={{ startTour, isTourActive, hasCompletedTour, markTourComplete }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}