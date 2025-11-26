import twilio from "twilio";
import { db } from "./server/db";
import { consultantWhatsappConfig } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkTwilioTemplates() {
  console.log("🔍 Checking Twilio WhatsApp Templates...\n");

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

  console.log(`📱 Account SID: ${config.twilioAccountSid}`);
  console.log(`📞 WhatsApp Number: ${config.twilioWhatsappNumber}\n`);

  const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

  try {
    // List Content Templates
    console.log("📋 Fetching Content Templates from Twilio...\n");
    
    const contents = await client.content.v1.contents.list({ 
      pageSize: 50 
    });

    if (contents.length === 0) {
      console.log("⚠️  No Content Templates found on this Twilio account");
      console.log("\n💡 You need to create WhatsApp Message Templates for proactive outreach");
      console.log("   Templates must be approved by WhatsApp/Meta before use");
      console.log("\n📖 Next steps:");
      console.log("   1. Create templates via Twilio Console: https://console.twilio.com/us1/develop/sms/content-editor");
      console.log("   2. Submit for WhatsApp approval (usually takes 1-48 hours)");
      console.log("   3. Use approved template SIDs in code");
    } else {
      console.log(`✅ Found ${contents.length} Content Template(s):\n`);
      
      for (const content of contents) {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  SID: ${content.sid}`);
        console.log(`  Friendly Name: ${content.friendlyName}`);
        console.log(`  Language: ${content.language || 'N/A'}`);
        console.log(`  Types: ${JSON.stringify(content.types)}`);
        
        // Fetch detailed info
        try {
          const details = await client.content.v1.contents(content.sid).fetch();
          console.log(`  Status: Not directly available - check Console`);
          console.log(`  Variables: ${JSON.stringify(details.types?.['twilio/text']?.body || 'N/A')}`);
        } catch (err) {
          console.log(`  (Could not fetch detailed info)`);
        }
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log("");
      }
      
      console.log("\n💡 To use these templates for proactive outreach:");
      console.log("   1. Verify templates are APPROVED by WhatsApp");
      console.log("   2. Copy the SID of the template you want to use");
      console.log("   3. Update whatsapp_templates column in consultant_whatsapp_config");
    }

    // Also check for any approved WhatsApp templates specifically
    console.log("\n🔍 Checking for WhatsApp-specific approved templates...");
    console.log("   (Note: Approval status is only visible in Twilio Console)");
    console.log("   Visit: https://console.twilio.com/us1/develop/sms/content-editor\n");

  } catch (error: any) {
    console.error("\n❌ Error fetching templates:", error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.moreInfo) {
      console.error(`   More info: ${error.moreInfo}`);
    }
  }

  process.exit(0);
}

checkTwilioTemplates().catch(console.error);
