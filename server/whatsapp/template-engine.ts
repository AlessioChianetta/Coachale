/**
 * Template Engine per Istruzioni Agente WhatsApp
 * 
 * Sistema di sostituzione variabili per template personalizzabili.
 * Supporta variabili ${...} con fallback automatici se dato mancante.
 */

// Lista completa variabili supportate
export const SUPPORTED_VARIABLES = [
  '${businessName}',
  '${businessDescription}',
  '${consultantDisplayName}',
  '${consultantBio}',
  '${consultantName}',
  '${idealState}',
  '${currentState}',
  '${mainObstacle}',
  '${firstName}',
  '${lastName}',
  '${uncino}',
  '${obiettivi}',
  '${desideri}',
  '${vision}',
  '${mission}',
  '${usp}',
  '${whoWeHelp}',
  '${whatWeDo}',
  '${resultsGenerated}',
  '${clientsHelped}',
  '${yearsExperience}',
] as const;

interface TemplateData {
  consultantConfig?: {
    businessName?: string;
    businessDescription?: string;
    consultantDisplayName?: string;
    consultantBio?: string;
    consultantName?: string;
    vision?: string;
    mission?: string;
    usp?: string;
    whoWeHelp?: string;
    whatWeDo?: string;
    resultsGenerated?: string;
    clientsHelped?: string;
    yearsExperience?: string;
    defaultUncino?: string;
    defaultObiettivi?: string;
    defaultDesideri?: string;
    defaultIdealState?: string;
  };
  proactiveLead?: {
    firstName?: string;
    lastName?: string;
    idealState?: string;
    leadInfo?: any;
  };
  clientState?: {
    currentState?: string;
    idealState?: string;
    mainObstacle?: string;
    obiettivi?: string;
    desideri?: string;
  };
}

/**
 * Risolve le variabili ${...} in un template con dati reali dal database
 * 
 * @param template - Template string con variabili ${...}
 * @param data - Dati da consultantConfig, proactiveLeads, clientStateTracking
 * @returns Template con variabili sostituite
 * 
 * @example
 * ```
 * const template = "Sei ${consultantDisplayName} di ${businessName}";
 * const result = resolveInstructionVariables(template, {
 *   consultantConfig: { businessName: "Software Orbitale", consultantDisplayName: "Marco" }
 * });
 * // result: "Sei Marco di Software Orbitale"
 * ```
 */
export function resolveInstructionVariables(
  template: string,
  data: TemplateData
): string {
  if (!template) {
    return '';
  }

  let result = template;

  // Sostituisci ${businessName}
  const businessName = data.consultantConfig?.businessName || 'il consulente';
  result = result.replace(/\$\{businessName\}/g, businessName);

  // Sostituisci ${consultantDisplayName}
  const consultantDisplayName = data.consultantConfig?.consultantDisplayName || 
                                 data.consultantConfig?.businessName || 
                                 'il consulente';
  result = result.replace(/\$\{consultantDisplayName\}/g, consultantDisplayName);

  // Sostituisci ${idealState} (priorità: clientState > proactiveLead > default)
  const idealState = data.clientState?.idealState ||
                     data.proactiveLead?.idealState ||
                     data.consultantConfig?.defaultIdealState ||
                     '';
  result = result.replace(/\$\{idealState\}/g, idealState);

  // Sostituisci ${currentState}
  const currentState = data.clientState?.currentState || '';
  result = result.replace(/\$\{currentState\}/g, currentState);

  // Sostituisci ${mainObstacle}
  const mainObstacle = data.clientState?.mainObstacle || '';
  result = result.replace(/\$\{mainObstacle\}/g, mainObstacle);

  // Sostituisci ${firstName}
  const firstName = data.proactiveLead?.firstName || '';
  result = result.replace(/\$\{firstName\}/g, firstName);

  // Sostituisci ${lastName}
  const lastName = data.proactiveLead?.lastName || '';
  result = result.replace(/\$\{lastName\}/g, lastName);

  // Sostituisci ${uncino}
  const uncino = data.consultantConfig?.defaultUncino || '';
  result = result.replace(/\$\{uncino\}/g, uncino);

  // Sostituisci ${obiettivi}
  const obiettivi = data.clientState?.obiettivi || 
                    data.consultantConfig?.defaultObiettivi || 
                    '';
  result = result.replace(/\$\{obiettivi\}/g, obiettivi);

  // Sostituisci ${desideri}
  const desideri = data.clientState?.desideri || 
                   data.consultantConfig?.defaultDesideri || 
                   '';
  result = result.replace(/\$\{desideri\}/g, desideri);

  // Sostituisci ${vision}
  const vision = data.consultantConfig?.vision || '';
  result = result.replace(/\$\{vision\}/g, vision);

  // Sostituisci ${mission}
  const mission = data.consultantConfig?.mission || '';
  result = result.replace(/\$\{mission\}/g, mission);

  // Sostituisci ${usp}
  const usp = data.consultantConfig?.usp || '';
  result = result.replace(/\$\{usp\}/g, usp);

  // Sostituisci ${whoWeHelp}
  const whoWeHelp = data.consultantConfig?.whoWeHelp || '';
  result = result.replace(/\$\{whoWeHelp\}/g, whoWeHelp);

  // Sostituisci ${whatWeDo}
  const whatWeDo = data.consultantConfig?.whatWeDo || '';
  result = result.replace(/\$\{whatWeDo\}/g, whatWeDo);

  // Sostituisci ${resultsGenerated}
  const resultsGenerated = data.consultantConfig?.resultsGenerated || '';
  result = result.replace(/\$\{resultsGenerated\}/g, resultsGenerated);

  // Sostituisci ${businessDescription}
  const businessDescription = data.consultantConfig?.businessDescription || '';
  result = result.replace(/\$\{businessDescription\}/g, businessDescription);

  // Sostituisci ${consultantBio}
  const consultantBio = data.consultantConfig?.consultantBio || '';
  result = result.replace(/\$\{consultantBio\}/g, consultantBio);

  // Sostituisci ${consultantName}
  const consultantName = data.consultantConfig?.consultantName || 
                         data.consultantConfig?.consultantDisplayName || 
                         '';
  result = result.replace(/\$\{consultantName\}/g, consultantName);

  // Sostituisci ${clientsHelped}
  const clientsHelped = data.consultantConfig?.clientsHelped || '';
  result = result.replace(/\$\{clientsHelped\}/g, clientsHelped);

  // Sostituisci ${yearsExperience}
  const yearsExperience = data.consultantConfig?.yearsExperience || '';
  result = result.replace(/\$\{yearsExperience\}/g, yearsExperience);

  return result;
}

/**
 * Estrae tutte le variabili ${...} presenti in un template
 * 
 * @param template - Template string
 * @returns Array di variabili trovate (es: ['${businessName}', '${idealState}'])
 */
export function extractVariables(template: string): string[] {
  if (!template) {
    return [];
  }

  const matches = template.match(/\$\{[^}]+\}/g);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Valida che tutte le variabili in un template siano supportate
 * 
 * @param template - Template string
 * @returns { valid: boolean, invalidVariables: string[], suggestions: string[] }
 */
export function validateTemplateVariables(template: string): {
  valid: boolean;
  invalidVariables: string[];
  suggestions: Record<string, string[]>;
} {
  const variables = extractVariables(template);
  const invalidVariables: string[] = [];
  const suggestions: Record<string, string[]> = {};

  for (const variable of variables) {
    if (!SUPPORTED_VARIABLES.includes(variable as any)) {
      invalidVariables.push(variable);
      
      // Trova suggerimenti simili (distanza Levenshtein)
      const similarVars = SUPPORTED_VARIABLES.filter(supportedVar => {
        const similarity = levenshteinDistance(variable, supportedVar);
        return similarity <= 3; // Max 3 caratteri di differenza
      });
      
      if (similarVars.length > 0) {
        suggestions[variable] = similarVars;
      }
    }
  }

  return {
    valid: invalidVariables.length === 0,
    invalidVariables,
    suggestions,
  };
}

/**
 * Calcola distanza Levenshtein tra due stringhe (per suggerimenti)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
