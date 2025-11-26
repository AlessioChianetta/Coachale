/**
 * Convert custom template variables to Twilio format
 * {nome_lead} → {{1}}, {nome_consulente} → {{2}} based on position
 */

interface VariableMapping {
  variableKey: string;
  position: number; // 1-indexed
}

export function convertToTwilioFormat(
  bodyText: string,
  variables: VariableMapping[]
): {
  convertedBody: string;
  variableMap: Map<string, number>;
} {
  // Sort by position
  const sorted = [...variables].sort((a, b) => a.position - b.position);
  
  let convertedBody = bodyText;
  const variableMap = new Map<string, number>();
  
  // Replace {variable_key} → {{position}}
  sorted.forEach(({ variableKey, position }) => {
    const regex = new RegExp(`\\{${variableKey}\\}`, 'g');
    convertedBody = convertedBody.replace(regex, `{{${position}}}`);
    variableMap.set(variableKey, position);
  });
  
  return { convertedBody, variableMap };
}

export function previewConversion(
  bodyText: string,
  variables: VariableMapping[]
): string {
  return convertToTwilioFormat(bodyText, variables).convertedBody;
}
