import { db } from "../server/db";
import { consultantWhatsappConfig } from "../shared/schema";

/**
 * Script to check available WhatsApp templates in Twilio account
 * This helps identify which Content SIDs are available for use
 */

async function checkTwilioTemplates() {
  console.log("🔍 Checking Twilio WhatsApp Templates...\n");

  try {
    // Get first agent config with Twilio credentials
    const agentConfigs = await db
      .select()
      .from(consultantWhatsappConfig)
      .limit(1);

    if (agentConfigs.length === 0) {
      console.error("❌ No agent configs found. Please create an agent config first.");
      process.exit(1);
    }

    const config = agentConfigs[0];
    
    if (!config.twilioAccountSid || !config.twilioAuthToken) {
      console.error("❌ Twilio credentials not found in agent config.");
      process.exit(1);
    }

    console.log(`✅ Using agent: ${config.agentName}`);
    console.log(`📱 Twilio Account: ${config.twilioAccountSid}\n`);

    // Import Twilio SDK
    const twilio = await import("twilio");
    const client = twilio.default(config.twilioAccountSid, config.twilioAuthToken);

    // Fetch all Content Templates
    console.log("📋 Fetching Content Templates...\n");
    const contents = await client.content.v1.contents.list({ limit: 50 });

    if (contents.length === 0) {
      console.log("⚠️  No Content Templates found in your account.");
      console.log("\n📚 Twilio Sandbox Pre-Approved Templates:");
      console.log("   These templates should be auto-available in Sandbox:\n");
      console.log("   1. Appointment Reminder:");
      console.log("      Body: 'Your appointment is coming up on {{1}} at {{2}}'");
      console.log("      Variables: {{1}}=date, {{2}}=time\n");
      console.log("   2. Order Notification:");
      console.log("      Body: 'Your {{1}} order of {{2}} has shipped and should be delivered on {{3}}. Details: {{4}}'");
      console.log("      Variables: {{1}}=type, {{2}}=item, {{3}}=date, {{4}}=details\n");
      console.log("   ℹ️  Note: You may need to create these templates in Twilio Console first.");
      console.log("   📍 Location: Console → Messaging → Content Template Builder");
    } else {
      console.log(`✅ Found ${contents.length} template(s):\n`);
      
      for (const content of contents) {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📄 Template: ${content.friendlyName}`);
        console.log(`   SID: ${content.sid}`);
        console.log(`   Language: ${content.language}`);
        console.log(`   Type: ${(content.types as any)?.['twilio/text']?.body ? 'Text' : 'Rich Media'}`);
        
        // Try to extract body text
        const types = content.types as any;
        if (types?.['twilio/text']?.body) {
          console.log(`   Body: "${types['twilio/text'].body}"`);
        }
        
        console.log(`   Status: ${content.approvalRequests?.status || 'N/A'}`);
        console.log(`   Created: ${content.dateCreated?.toISOString()}`);
        console.log("");
      }
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      console.log("💡 To use a template, copy the SID and paste it in your agent config:");
      console.log("   - openingMessageContentSid: [paste SID here]");
      console.log("   - followupMessageContentSid: [paste SID here]");
    }

    console.log("\n✅ Done!\n");
    process.exit(0);

  } catch (error: any) {
    console.error("\n❌ Error checking templates:", error.message);
    if (error.code === 20003) {
      console.log("\n🔐 Authentication failed. Please check:");
      console.log("   - Twilio Account SID is correct");
      console.log("   - Twilio Auth Token is correct");
      console.log("   - Credentials have not expired");
    }
    process.exit(1);
  }
}

checkTwilioTemplates();
