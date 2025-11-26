import twilio from "twilio";
import { db } from "./server/db";
import { consultantWhatsappConfig } from "./shared/schema";
import { eq } from "drizzle-orm";

async function createWhatsAppTemplates() {
  console.log("🚀 Creating WhatsApp Message Templates for Proactive Outreach\n");

  // Get first active config
  const [config] = await db
    .select()
    .from(consultantWhatsappConfig)
    .where(eq(consultantWhatsappConfig.isActive, true))
    .limit(1);

  if (!config) {
    console.error("❌ No active WhatsApp config found");
    process.exit(1);
  }

  const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

  // Template definitions
  const templates = [
    {
      friendlyName: "proactive_opening_message_it",
      language: "it",
      variables: {
        "1": "Mario",           // Nome lead
        "2": "Luca",            // Nome consulente
        "3": "Orbitale",        // Nome azienda
        "4": "ci siamo conosciuti all'evento di Milano",  // Uncino
        "5": "raddoppiare il fatturato"  // Stato ideale
      },
      types: {
        "twilio/text": {
          body: "Ciao {{1}}! Sono {{2}} dagli uffici di {{3}}.\n\nTi scrivo perché {{4}}.\n\nDato che non voglio sprecare il tuo tempo: hai 30 secondi da dedicarmi per capire se possiamo aiutarti a raggiungere {{5}}?"
        }
      }
    },
    {
      friendlyName: "proactive_followup_gentle_it",
      language: "it",
      variables: {
        "1": "Mario",    // Nome lead
        "2": "Luca",     // Nome consulente
        "3": "raddoppiare il fatturato"  // Stato ideale
      },
      types: {
        "twilio/text": {
          body: "Ciao {{1}}, sono ancora {{2}}. Ho visto che forse il mio messaggio si è perso. Se hai anche solo un minuto, mi farebbe piacere capire se posso esserti d'aiuto per {{3}}. Cosa ne dici?"
        }
      }
    },
    {
      friendlyName: "proactive_followup_value_it",
      language: "it",
      variables: {
        "1": "Mario",    // Nome lead
        "2": "Luca",     // Nome consulente
        "3": "raddoppiare il fatturato"  // Stato ideale
      },
      types: {
        "twilio/text": {
          body: "{{1}}, {{2}} qui. Capisco che potresti essere occupato, ma ho aiutato molte persone nella tua situazione a {{3}}. Vale la pena scambiare due parole?"
        }
      }
    },
    {
      friendlyName: "proactive_followup_final_it",
      language: "it",
      variables: {
        "1": "Mario",    // Nome lead
        "2": "raggiungere i tuoi obiettivi"  // Stato ideale
      },
      types: {
        "twilio/text": {
          body: "Ciao {{1}}, questo è il mio ultimo tentativo di contatto. Se {{2}} è ancora importante per te, sono qui. Altrimenti capisco e ti lascio in pace. Fammi sapere!"
        }
      }
    }
  ];

  console.log("📝 Templates to create:\n");
  
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    console.log(`${i + 1}. ${template.friendlyName}`);
    console.log(`   Language: ${template.language}`);
    console.log(`   Body: ${template.types['twilio/text'].body}`);
    console.log(`   Sample Variables: ${JSON.stringify(template.variables)}`);
    console.log("");
  }

  console.log("⚠️  IMPORTANT NOTES BEFORE PROCEEDING:");
  console.log("   1. These templates will be PENDING until approved by WhatsApp/Meta");
  console.log("   2. Approval can take 1-48 hours");
  console.log("   3. Templates in Italian may have different approval times");
  console.log("   4. You'll need to check approval status in Twilio Console");
  console.log("   5. Only APPROVED templates can be used for proactive messages\n");

  console.log("Would you like to proceed? (Press Ctrl+C to cancel or wait 5 seconds to continue)\n");
  
  // Wait 5 seconds to allow user to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("🚀 Creating templates...\n");

  const createdTemplates: Array<{ friendlyName: string; sid: string; status: string }> = [];

  for (const template of templates) {
    try {
      console.log(`📤 Creating: ${template.friendlyName}...`);
      
      const content = await client.content.v1.contents.create({
        friendlyName: template.friendlyName,
        language: template.language,
        variables: template.variables,
        types: template.types
      });

      console.log(`   ✅ Created! SID: ${content.sid}`);
      console.log(`   Status: PENDING (awaiting WhatsApp approval)`);
      
      createdTemplates.push({
        friendlyName: template.friendlyName,
        sid: content.sid,
        status: "pending"
      });
      
      console.log("");
    } catch (error: any) {
      console.error(`   ❌ Error creating ${template.friendlyName}:`, error.message);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      console.log("");
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  if (createdTemplates.length > 0) {
    console.log("✅ Created templates:\n");
    createdTemplates.forEach(t => {
      console.log(`   ${t.friendlyName}`);
      console.log(`   SID: ${t.sid}`);
      console.log(`   Status: ${t.status}`);
      console.log("");
    });

    console.log("\n📋 NEXT STEPS:");
    console.log("   1. Wait for WhatsApp/Meta approval (1-48 hours)");
    console.log("   2. Check approval status in Twilio Console:");
    console.log("      https://console.twilio.com/us1/develop/sms/content-editor");
    console.log("   3. Once APPROVED, update database:");
    console.log(`      
      UPDATE consultant_whatsapp_config 
      SET whatsapp_templates = jsonb_build_object(
        'openingMessageContentSid', '${createdTemplates.find(t => t.friendlyName.includes('opening'))?.sid || 'YOUR_OPENING_SID'}',
        'followUpGentleContentSid', '${createdTemplates.find(t => t.friendlyName.includes('gentle'))?.sid || 'YOUR_GENTLE_SID'}',
        'followUpValueContentSid', '${createdTemplates.find(t => t.friendlyName.includes('value'))?.sid || 'YOUR_VALUE_SID'}',
        'followUpFinalContentSid', '${createdTemplates.find(t => t.friendlyName.includes('final'))?.sid || 'YOUR_FINAL_SID'}'
      )
      WHERE id = '${config.id}';
      `);
    console.log("");
  } else {
    console.log("❌ No templates were created successfully");
  }

  process.exit(0);
}

createWhatsAppTemplates().catch(console.error);
