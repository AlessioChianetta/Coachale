import { config } from './config.js';
import { logger } from './logger.js';
import { startVoiceBridgeServer } from './voice-bridge-server.js';

const log = logger.child('MAIN');

function printBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     █████╗ ██╗     ███████╗███████╗███████╗██╗ █████╗         ║
║    ██╔══██╗██║     ██╔════╝██╔════╝██╔════╝██║██╔══██╗        ║
║    ███████║██║     █████╗  ███████╗███████╗██║███████║        ║
║    ██╔══██║██║     ██╔══╝  ╚════██║╚════██║██║██╔══██║        ║
║    ██║  ██║███████╗███████╗███████║███████║██║██║  ██║        ║
║    ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚══════╝╚═╝╚═╝  ╚═╝        ║
║                                                               ║
║              VOICE BRIDGE - FreeSWITCH ↔ Gemini               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

function printConfig(): void {
  log.info('Configuration loaded:');
  log.info(`  WebSocket Server: ${config.ws.host}:${config.ws.port}`);
  log.info(`  Auth Token: ${config.ws.authToken ? 'configured' : 'disabled'}`);
  log.info(`  Replit WS: ${config.replit.wsUrl || 'not configured'}`);
  log.info(`  Voice: ${config.voice.voiceId}`);
  log.info(`  Max Concurrent Calls: ${config.session.maxConcurrent}`);
  log.info(`  Session Timeout: ${config.session.timeoutMs}ms`);
  log.info(`  Log Level: ${config.logLevel}`);
}

async function main(): Promise<void> {
  printBanner();
  printConfig();

  log.info('Starting Voice Bridge Server...');
  
  try {
    startVoiceBridgeServer();
  } catch (error) {
    log.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
