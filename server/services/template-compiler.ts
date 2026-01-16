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

function wrapInEmailTemplate(content: string, unsubscribeLink: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="it">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Email</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, span, a {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!--[if mso]>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center">
        <tr>
        <td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff;">
          <tr>
            <td style="padding: 48px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 18px; line-height: 28px; color: #333333;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 40px; border-top: 1px solid #e8e8e8; font-family: Arial, Helvetica, sans-serif;">
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #888888; text-align: center;">
                Non vuoi pi&ugrave; ricevere queste email?
                <a href="${unsubscribeLink}" style="color: #666666; text-decoration: underline;">Cancella iscrizione</a>
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
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
  
  // Wrap body in professional email template
  const unsubscribeLink = variables.linkUnsubscribe || "#";
  const wrappedBody = wrapInEmailTemplate(compiledBody, unsubscribeLink);
  
  return {
    subject: compiledSubject,
    body: wrappedBody,
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
