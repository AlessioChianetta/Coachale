import { Config } from 'driver.js';

export const driverConfig: Config = {
  // Testi in italiano
  showProgress: true,
  progressText: 'Step {{current}} di {{total}}',
  nextBtnText: 'Avanti →',
  prevBtnText: '← Indietro',
  doneBtnText: '✓ Completato!',
  
  // Animazioni fluide
  animate: true,
  smoothScroll: true,
  
  // Overlay scuro professionale
  overlayColor: 'rgba(0, 0, 0, 0.75)',
  overlayOpacity: 0.75,
  
  // Classe custom per matching con design system
  popoverClass: 'consulente-pro-tour-popover',
  
  // Impedisci chiusura accidentale cliccando fuori
  allowClose: false,
  
  // Permetti navigazione con tastiera
  showButtons: ['next', 'previous', 'close'],
  
  // Disabilita animazioni per step senza elemento
  disableActiveInteraction: false,
};
