import * as schema from "@shared/schema";

export interface TemplateVariables {
  nome: string;
  cognome?: string;
  nomeCompleto?: string;
  email?: string;
  linkCalendario?: string;
  nomeAzienda?: string;
  whatsapp?: string;
  firmaEmail?: string;
  linkUnsubscribe?: string;
  giorno?: number;
  [key: string]: string | number | undefined;
}

export interface CompileTemplateResult {
  subject: string;
  body: string;
  errors: string[];
}

const VARIABLE_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
const MAX_SUBJECT_LENGTH = 150;
const MAX_BODY_LENGTH = 50000;

const VARIABLE_FALLBACKS: Record<string, string> = {
  nome: "Cliente",
  cognome: "",
  nomeCompleto: "Cliente",
  email: "",
  linkCalendario: "#",
  nomeAzienda: "La nostra azienda",
  whatsapp: "",
  firmaEmail: "Il tuo consulente",
  linkUnsubscribe: "#",
  giorno: "1",
};

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function replaceVariables(
  text: string,
  variables: TemplateVariables,
  errors: string[]
): string {
  return text.replace(VARIABLE_REGEX, (match, varName) => {
    const value = variables[varName];
    
    if (value !== undefined && value !== null && value !== "") {
      return typeof value === "number" ? String(value) : escapeHtml(String(value));
    }
    
    const fallback = VARIABLE_FALLBACKS[varName];
    if (fallback !== undefined) {
      return typeof fallback === "number" ? String(fallback) : escapeHtml(fallback);
    }
    
    errors.push(`Variabile {{${varName}}} non trovata e senza fallback`);
    return match;
  });
}

export function compileTemplate(
  template: { subject: string; body: string },
  variables: TemplateVariables
): CompileTemplateResult {
  const errors: string[] = [];
  
  if (!template.subject || !template.body) {
    errors.push("Template invalido: subject o body mancante");
    return {
      subject: template.subject || "",
      body: template.body || "",
      errors,
    };
  }
  
  if (!variables.nome) {
    variables.nome = VARIABLE_FALLBACKS.nome;
  }
  
  if (variables.nome && variables.cognome) {
    variables.nomeCompleto = `${variables.nome} ${variables.cognome}`.trim();
  } else {
    variables.nomeCompleto = variables.nome || VARIABLE_FALLBACKS.nomeCompleto;
  }
  
  let compiledSubject = replaceVariables(template.subject, variables, errors);
  let compiledBody = replaceVariables(template.body, variables, errors);
  
  if (compiledSubject.length > MAX_SUBJECT_LENGTH) {
    compiledSubject = compiledSubject.substring(0, MAX_SUBJECT_LENGTH - 3) + "...";
    errors.push(`Subject troncato a ${MAX_SUBJECT_LENGTH} caratteri`);
  }
  
  if (compiledBody.length > MAX_BODY_LENGTH) {
    compiledBody = compiledBody.substring(0, MAX_BODY_LENGTH - 3) + "...";
    errors.push(`Body troncato a ${MAX_BODY_LENGTH} caratteri`);
  }
  
  return {
    subject: compiledSubject,
    body: compiledBody,
    errors,
  };
}

export function buildTemplateVariables(
  lead: schema.ProactiveLead,
  consultantVariables: schema.ConsultantEmailVariables | null,
  unsubscribeToken?: string,
  currentDay?: number
): TemplateVariables {
  const leadInfo = lead.leadInfo as any || {};
  
  const baseUrl = process.env.REPLIT_DOMAINS?.split(",")[0] 
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : process.env.APP_URL || "https://app.example.com";
  
  const variables: TemplateVariables = {
    nome: lead.firstName || leadInfo.nome || "Cliente",
    cognome: lead.lastName || leadInfo.cognome || "",
    nomeCompleto: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Cliente",
    email: (lead as any).email || leadInfo.email || "",
    linkCalendario: consultantVariables?.calendarLink || "#",
    nomeAzienda: consultantVariables?.companyName || "La nostra azienda",
    whatsapp: consultantVariables?.whatsappNumber || "",
    firmaEmail: consultantVariables?.emailSignature || "Il tuo consulente",
    linkUnsubscribe: unsubscribeToken ? `${baseUrl}/unsubscribe/${unsubscribeToken}` : "#",
    giorno: currentDay || 1,
  };
  
  if (consultantVariables?.customVariables) {
    const customVars = consultantVariables.customVariables as Record<string, string>;
    for (const [key, value] of Object.entries(customVars)) {
      variables[key] = value;
    }
  }
  
  return variables;
}

export function extractVariablesFromTemplate(template: string): string[] {
  const matches = template.matchAll(VARIABLE_REGEX);
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

export function validateTemplate(template: { subject: string; body: string }): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!template.subject || template.subject.trim().length === 0) {
    errors.push("Subject mancante");
  }
  
  if (!template.body || template.body.trim().length === 0) {
    errors.push("Body mancante");
  }
  
  if (template.subject && template.subject.length > MAX_SUBJECT_LENGTH) {
    warnings.push(`Subject troppo lungo (${template.subject.length}/${MAX_SUBJECT_LENGTH})`);
  }
  
  if (template.body && template.body.length > MAX_BODY_LENGTH) {
    warnings.push(`Body troppo lungo (${template.body.length}/${MAX_BODY_LENGTH})`);
  }
  
  const subjectVars = template.subject ? extractVariablesFromTemplate(template.subject) : [];
  const bodyVars = template.body ? extractVariablesFromTemplate(template.body) : [];
  const allVariables = [...new Set([...subjectVars, ...bodyVars])];
  
  const knownVariables = Object.keys(VARIABLE_FALLBACKS);
  for (const variable of allVariables) {
    if (!knownVariables.includes(variable)) {
      warnings.push(`Variabile {{${variable}}} non è standard (sarà lasciata intatta se non definita)`);
    }
  }
  
  if (!allVariables.includes("linkUnsubscribe") && template.body) {
    warnings.push("Manca {{linkUnsubscribe}} per conformità GDPR");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    variables: allVariables,
  };
}
