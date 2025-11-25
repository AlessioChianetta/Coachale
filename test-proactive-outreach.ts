import { db } from "./server/db";
import { 
  proactiveLeads, 
  users, 
  consultantWhatsappConfig, 
  whatsappConversations, 
  whatsappMessages 
} from './shared/schema';
import { eq, lte, and, sql } from 'drizzle-orm';
import { 
  getDaysSinceLastContact,
  buildOpeningTemplateVariables,
  buildGentleFollowUpTemplateVariables,
  buildValueFollowUpTemplateVariables,
  buildFinalFollowUpTemplateVariables
} from './server/whatsapp/proactive-message-builder';
import { sendWhatsAppMessage } from './server/whatsapp/twilio-client';
import { findOrCreateConversation } from './server/whatsapp/webhook-handler';

async function testProactiveOutreach() {
  console.log('\n🧪 TESTING PROACTIVE OUTREACH SYSTEM');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const isDryRun = process.env.DRY_RUN !== 'false';

  if (isDryRun) {
    console.log('✅ Running in DRY RUN mode (safe for testing)');
    console.log('   → No real WhatsApp messages will be sent');
    console.log('   → Database will be updated normally for testing');
    console.log('   → To enable LIVE mode: DRY_RUN=false tsx test-proactive-outreach.ts');
  } else {
    console.log('\n⚠️  ══════════════════════════════════════════════════════════');
    console.log('⚠️  WARNING: LIVE MODE - REAL MESSAGES WILL BE SENT!');
    console.log('⚠️  ══════════════════════════════════════════════════════════');
    console.log('⚠️  This will send actual WhatsApp messages using Twilio');
    console.log('⚠️  Recipients will receive these messages on their phones');
    console.log('⚠️  To use DRY RUN mode instead: tsx test-proactive-outreach.ts');
    console.log('⚠️  (or set DRY_RUN=true explicitly)');
    console.log('⚠️  ══════════════════════════════════════════════════════════');
    console.log('\n⏳ Waiting 5 seconds before proceeding...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('');

  try {
    // Query pending leads
    const pendingLeads = await db
      .select({
        lead: proactiveLeads,
        consultant: users,
        agentConfig: consultantWhatsappConfig
      })
      .from(proactiveLeads)
      .innerJoin(users, eq(proactiveLeads.consultantId, users.id))
      .innerJoin(consultantWhatsappConfig, eq(proactiveLeads.agentConfigId, consultantWhatsappConfig.id))
      .where(
        and(
          eq(proactiveLeads.status, 'pending'),
          lte(proactiveLeads.contactSchedule, new Date()),
          eq(consultantWhatsappConfig.agentType, 'proactive_setter')
        )
      );

    console.log(`📋 Found ${pendingLeads.length} pending lead(s) ready to contact\n`);

    if (pendingLeads.length === 0) {
      console.log('⚠️  No leads found. Make sure:');
      console.log('   1. Lead exists with status="pending"');
      console.log('   2. contact_schedule is in the past');
      console.log('   3. Agent config has agent_type="proactive_setter"');
      return;
    }

    for (const { lead, consultant, agentConfig } of pendingLeads) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📤 Processing: ${lead.firstName} ${lead.lastName}`);
      console.log(`   Phone: ${lead.phoneNumber}`);
      console.log(`   Agent: ${agentConfig.agentName} (${agentConfig.agentType})`);
      console.log(`   Scheduled: ${lead.contactSchedule}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Check templates
      const templates = agentConfig.whatsappTemplates as {
        openingMessageContentSid?: string;
        followUpGentleContentSid?: string;
        followUpValueContentSid?: string;
        followUpFinalContentSid?: string;
      } | null;

      console.log(`📋 Templates configured: ${templates ? 'YES' : 'NO'}`);
      if (templates) {
        console.log(`   Opening: ${templates.openingMessageContentSid || 'N/A'}`);
        console.log(`   Gentle: ${templates.followUpGentleContentSid || 'N/A'}`);
        console.log(`   Value: ${templates.followUpValueContentSid || 'N/A'}`);
        console.log(`   Final: ${templates.followUpFinalContentSid || 'N/A'}`);
      }
      console.log('');

      // Build message
      const consultantInfo = {
        id: consultant.id,
        firstName: consultant.firstName,
        lastName: consultant.lastName
      };

      const agentInfo = {
        id: agentConfig.id,
        agentName: agentConfig.agentName || `${consultant.firstName} ${consultant.lastName}`,
        businessName: agentConfig.businessName
      };

      let message: string;
      let contentSid: string | undefined;
      let contentVariables: Record<string, string> | undefined;

      // Opening message - STRICT VALIDATION (no fallbacks)
      if (templates?.openingMessageContentSid) {
        console.log(`📋 Using template for opening message`);
        contentSid = templates.openingMessageContentSid;
        contentVariables = buildOpeningTemplateVariables(lead, consultantInfo, agentInfo);
        console.log(`   Template SID: ${contentSid}`);
        console.log(`   Variables: ${JSON.stringify(contentVariables)}`);
        message = `TEMPLATE:${contentSid}`;
      } else {
        console.error(`\n❌ NO TEMPLATE ASSIGNED - SKIPPING LEAD`);
        console.error(`   Agent: ${agentConfig.agentName}`);
        console.error(`   Lead: ${lead.firstName} ${lead.lastName}`);
        console.error(`   Reason: No opening template in "Assegnazione Template agli Agenti"`);
        console.error(`   Action: Lead skipped\n`);
        continue; // Skip this lead
      }
      
      console.log(`\n📝 Message type: Template-based`);
      console.log(`   Content SID: ${contentSid}\n`);

      // Ensure phone number has whatsapp: prefix
      const formattedPhoneNumber = lead.phoneNumber.startsWith('whatsapp:') 
        ? lead.phoneNumber 
        : `whatsapp:${lead.phoneNumber}`;

      // Find or create conversation
      console.log(`🔍 Finding/creating conversation...`);
      const conversation = await findOrCreateConversation(
        formattedPhoneNumber,
        lead.consultantId
      );
      console.log(`   Conversation ID: ${conversation.id}\n`);

      // Save message to database first
      console.log(`💾 Saving message to database...`);
      const [savedMessage] = await db
        .insert(whatsappMessages)
        .values({
          conversationId: conversation.id,
          messageText: message,
          direction: 'outbound',
          sender: 'ai',
          mediaType: 'text',
        })
        .returning();
      console.log(`   Message ID: ${savedMessage.id}\n`);

      // Send via Twilio
      console.log(`📤 Sending via Twilio...`);
      try {
        await sendWhatsAppMessage(
          lead.consultantId,
          formattedPhoneNumber,
          message,
          savedMessage.id,
          contentSid ? {
            contentSid,
            contentVariables
          } : undefined
        );

        console.log(`✅ Message sent successfully!\n`);

        // Update lead status
        console.log(`📝 Updating lead status...`);
        await db
          .update(proactiveLeads)
          .set({
            lastContactedAt: new Date(),
            status: 'contacted',
            lastMessageSent: message,
            updatedAt: new Date(),
            metadata: {
              ...lead.metadata,
              conversationId: conversation.id,
              testRun: true
            }
          })
          .where(eq(proactiveLeads.id, lead.id));

        console.log(`✅ Lead status updated to 'contacted'\n`);

      } catch (error: any) {
        console.error(`\n❌ ERROR sending message:`, error.message);
        if (error.code) {
          console.error(`   Error code: ${error.code}`);
        }
        if (error.moreInfo) {
          console.error(`   More info: ${error.moreInfo}`);
        }
        console.error('');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 TEST COMPLETED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }

  process.exit(0);
}

testProactiveOutreach().catch(console.error);
