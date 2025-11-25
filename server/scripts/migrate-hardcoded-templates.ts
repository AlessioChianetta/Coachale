/**
 * Migration Script: Convert Hardcoded WhatsApp Templates to Custom Database Templates
 * 
 * This script migrates the 4 hardcoded ORBITALE templates from server/routes.ts (lines 6992-7029)
 * into the custom template system stored in the database.
 * 
 * Usage:
 *   npm run migrate:templates [consultantId]
 * 
 * If consultantId is not provided, it will use the first active consultant found.
 */

import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Template type mapping from hardcoded names to database enum
type TemplateType = 'opening' | 'followup_gentle' | 'followup_value' | 'followup_final';

interface TemplateDefinition {
  friendlyName: string;
  templateType: TemplateType;
  templateName: string;
  description: string;
  twilioBody: string;
  variableMapping: Record<string, string>; // Position -> variableKey (e.g., "1" -> "nome_lead")
}

// Define the 4 hardcoded templates to migrate
const HARDCODED_TEMPLATES: TemplateDefinition[] = [
  {
    friendlyName: 'orbitale_apertura_it',
    templateType: 'opening',
    templateName: 'Messaggio Apertura Metodo ORBITALE',
    description: 'Template di apertura iniziale con uncino e stato ideale',
    twilioBody: 'Ciao {{1}}! Sono {{2}} dagli uffici di {{3}}. Ti scrivo perché {{4}}. Dato che non voglio sprecare il tuo tempo: hai 30 secondi da dedicarmi per capire se possiamo aiutarti a raggiungere {{5}}?',
    variableMapping: {
      '1': 'nome_lead',
      '2': 'nome_consulente',
      '3': 'nome_azienda',
      '4': 'uncino',
      '5': 'stato_ideale'
    }
  },
  {
    friendlyName: 'orbitale_followup_gentile_it',
    templateType: 'followup_gentle',
    templateName: 'Follow-up Gentile',
    description: 'Primo follow-up gentile per lead che non hanno risposto',
    twilioBody: 'Ciao {{1}}, sono ancora {{2}}. Ho visto che forse il mio messaggio si è perso. Se hai anche solo un minuto, mi farebbe piacere capire se posso esserti d\'aiuto per {{3}}. Cosa ne dici?',
    variableMapping: {
      '1': 'nome_lead',
      '2': 'nome_consulente',
      '3': 'stato_ideale'
    }
  },
  {
    friendlyName: 'orbitale_followup_valore_it',
    templateType: 'followup_value',
    templateName: 'Follow-up Valore',
    description: 'Follow-up con focus sul valore fornito',
    twilioBody: '{{1}}, {{2}} qui. Capisco che potresti essere occupato, ma ho aiutato molte persone nella tua situazione a {{3}}. Vale la pena scambiare due parole?',
    variableMapping: {
      '1': 'nome_lead',
      '2': 'nome_consulente',
      '3': 'stato_ideale'
    }
  },
  {
    friendlyName: 'orbitale_followup_finale_it',
    templateType: 'followup_final',
    templateName: 'Follow-up Finale',
    description: 'Ultimo tentativo di contatto prima di chiudere',
    twilioBody: 'Ciao {{1}}, questo è il mio ultimo tentativo di contatto. Se {{2}} è ancora importante per te, sono qui. Altrimenti capisco e ti lascio in pace. Fammi sapere!',
    variableMapping: {
      '1': 'nome_lead',
      '2': 'stato_ideale'
    }
  }
];

/**
 * Convert Twilio variable format {{1}} to readable format {variable_key}
 */
function convertFromTwilioFormat(
  twilioBody: string, 
  variableMapping: Record<string, string>
): string {
  let result = twilioBody;
  
  // Replace {{1}} with {nome_lead}, {{2}} with {nome_consulente}, etc.
  for (const [twilioKey, variableKey] of Object.entries(variableMapping)) {
    const twilioPlaceholder = `{{${twilioKey}}}`;
    const readablePlaceholder = `{${variableKey}}`;
    result = result.replace(new RegExp(twilioPlaceholder.replace(/[{}]/g, '\\$&'), 'g'), readablePlaceholder);
  }
  
  return result;
}

/**
 * Get variable catalog ID by variable key
 */
async function getVariableCatalogId(variableKey: string): Promise<string | null> {
  const [variable] = await db
    .select({ id: schema.whatsappVariableCatalog.id })
    .from(schema.whatsappVariableCatalog)
    .where(eq(schema.whatsappVariableCatalog.variableKey, variableKey))
    .limit(1);
  
  return variable?.id || null;
}

/**
 * Check if template already exists for consultant
 */
async function templateExists(consultantId: string, templateType: TemplateType): Promise<boolean> {
  const [existing] = await db
    .select({ id: schema.whatsappCustomTemplates.id })
    .from(schema.whatsappCustomTemplates)
    .where(
      and(
        eq(schema.whatsappCustomTemplates.consultantId, consultantId),
        eq(schema.whatsappCustomTemplates.templateType, templateType)
      )
    )
    .limit(1);
  
  return !!existing;
}

/**
 * Migrate a single template
 */
async function migrateTemplate(
  consultantId: string, 
  template: TemplateDefinition
): Promise<void> {
  // Check if template already exists
  const exists = await templateExists(consultantId, template.templateType);
  
  if (exists) {
    console.log(`⏭️  Template '${template.templateName}' (${template.templateType}) già esistente, skip`);
    return;
  }

  // Use transaction for atomicity
  await db.transaction(async (tx) => {
    // 1. Create custom template record
    const [customTemplate] = await tx
      .insert(schema.whatsappCustomTemplates)
      .values({
        consultantId,
        templateName: template.templateName,
        templateType: template.templateType,
        description: template.description,
      })
      .returning();

    console.log(`  📝 Created template: ${customTemplate.id}`);

    // 2. Convert body text from Twilio format to readable format
    const convertedBody = convertFromTwilioFormat(template.twilioBody, template.variableMapping);
    
    console.log(`  🔄 Converted body: ${template.twilioBody} → ${convertedBody}`);

    // 3. Create template version
    const [templateVersion] = await tx
      .insert(schema.whatsappTemplateVersions)
      .values({
        templateId: customTemplate.id,
        versionNumber: 1,
        bodyText: convertedBody,
        twilioContentSid: null, // Will be set when exported to Twilio
        twilioStatus: 'not_synced',
        isActive: true,
        createdBy: consultantId,
      })
      .returning();

    console.log(`  📄 Created version: ${templateVersion.id} (v1)`);

    // 4. Create variable mappings
    const variableEntries = Object.entries(template.variableMapping);
    
    for (const [position, variableKey] of variableEntries) {
      const catalogId = await getVariableCatalogId(variableKey);
      
      if (!catalogId) {
        throw new Error(`Variable '${variableKey}' not found in catalog`);
      }

      await tx
        .insert(schema.whatsappTemplateVariables)
        .values({
          templateVersionId: templateVersion.id,
          variableCatalogId: catalogId,
          position: parseInt(position),
        });

      console.log(`  🔗 Mapped variable: position ${position} → ${variableKey} (${catalogId})`);
    }

    console.log(`✅ Template '${template.templateName}' (${template.templateType}) creato con successo`);
  });
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🔄 Migrazione Template Hardcoded → Custom\n');

  try {
    // Get consultantId from command line args or use first consultant
    let consultantId = process.argv[2];

    if (!consultantId) {
      console.log('📌 Nessun consultantId fornito, cerco primo consultant attivo...');
      
      const [firstConsultant] = await db
        .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.role, 'consultant'),
            eq(schema.users.isActive, true)
          )
        )
        .limit(1);

      if (!firstConsultant) {
        throw new Error('Nessun consultant attivo trovato nel database');
      }

      consultantId = firstConsultant.id;
      console.log(`✓ Trovato: ${firstConsultant.firstName} ${firstConsultant.lastName} (${consultantId})\n`);
    } else {
      console.log(`📝 Consultant ID: ${consultantId}\n`);
    }

    // Verify consultant exists and is active
    const [consultant] = await db
      .select({ 
        id: schema.users.id, 
        firstName: schema.users.firstName, 
        lastName: schema.users.lastName,
        isActive: schema.users.isActive 
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, consultantId),
          eq(schema.users.role, 'consultant')
        )
      )
      .limit(1);

    if (!consultant) {
      throw new Error(`Consultant con ID ${consultantId} non trovato o non è un consultant`);
    }

    if (!consultant.isActive) {
      console.warn(`⚠️  Warning: Consultant ${consultant.firstName} ${consultant.lastName} non è attivo`);
    }

    // Migrate each template
    let createdCount = 0;
    
    for (const template of HARDCODED_TEMPLATES) {
      try {
        const existsBefore = await templateExists(consultantId, template.templateType);
        await migrateTemplate(consultantId, template);
        const existsAfter = await templateExists(consultantId, template.templateType);
        
        if (!existsBefore && existsAfter) {
          createdCount++;
        }
      } catch (error: any) {
        console.error(`❌ Errore durante migrazione di '${template.templateName}':`, error.message);
        throw error; // Re-throw to trigger rollback
      }
    }

    console.log(`\n🎉 Migrazione completata: ${createdCount} template creati`);

    // Summary
    console.log('\n📊 Riepilogo:');
    for (const template of HARDCODED_TEMPLATES) {
      const exists = await templateExists(consultantId, template.templateType);
      console.log(`  ${exists ? '✅' : '❌'} ${template.templateName} (${template.templateType})`);
    }

  } catch (error: any) {
    console.error('\n❌ Migrazione fallita:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrate();
