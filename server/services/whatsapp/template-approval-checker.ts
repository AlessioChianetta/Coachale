/**
 * Shared service for checking WhatsApp template approval status via Twilio API
 * Uses multi-path fallback strategy to reliably detect approval status
 */
export async function checkTemplateApprovalStatus(
  twilioAccountSid: string,
  twilioAuthToken: string,
  contentSid: string
): Promise<{ approved: boolean; status: string; reason?: string }> {
  try {
    const twilio = (await import('twilio')).default;
    const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    
    // STRATEGY 1: Fetch template content details from Twilio Content API
    console.log(`🔍 [TEMPLATE VALIDATION] Fetching content details for ${contentSid}...`);
    const content = await twilioClient.content.v1.contents(contentSid).fetch();
    
    // 🔥 DEBUG: Log the FULL API response to understand structure
    console.log(`📋 [API RESPONSE] Full content object keys: ${Object.keys(content).join(', ')}`);
    console.log(`📋 [API RESPONSE] approvalRequests type: ${typeof content.approvalRequests}`);
    
    if (content.approvalRequests) {
      console.log(`📋 [API RESPONSE] approvalRequests keys: ${Object.keys(content.approvalRequests as any).join(', ')}`);
      const approvalReq = content.approvalRequests as any;
      if (approvalReq.whatsapp) {
        console.log(`📋 [API RESPONSE] whatsapp approval object:`, JSON.stringify(approvalReq.whatsapp, null, 2));
      }
    }
    
    if (content.types) {
      console.log(`📋 [API RESPONSE] types keys: ${Object.keys(content.types).join(', ')}`);
    }
    
    let approvalStatus: string | null = null;
    let rejectionReason: string | undefined;
    
    // PATH 1: Try content.approvalRequests.whatsapp.status (most common)
    const approvalRequests = content.approvalRequests as any;
    if (approvalRequests?.whatsapp?.status) {
      approvalStatus = approvalRequests.whatsapp.status;
      rejectionReason = approvalRequests.whatsapp.rejection_reason;
      console.log(`✅ [PATH 1] Found status via approvalRequests.whatsapp.status: ${approvalStatus}`);
    }
    
    // PATH 2: Try content.types['twilio/whatsapp'] structure
    if (!approvalStatus && content.types) {
      const types = content.types as any;
      if (types['twilio/whatsapp']?.approval?.status) {
        approvalStatus = types['twilio/whatsapp'].approval.status;
        console.log(`✅ [PATH 2] Found status via types['twilio/whatsapp'].approval.status: ${approvalStatus}`);
      } else if (types['twilio/whatsapp']?.status) {
        approvalStatus = types['twilio/whatsapp'].status;
        console.log(`✅ [PATH 2] Found status via types['twilio/whatsapp'].status: ${approvalStatus}`);
      }
    }
    
    // PATH 3: Try fetching from separate ApprovalRequests endpoint
    if (!approvalStatus) {
      try {
        console.log(`🔄 [PATH 3] Trying separate ApprovalRequests endpoint...`);
        const approvalFetch = await twilioClient.content.v1
          .contents(contentSid)
          .approvalFetch()
          .fetch();
        
        console.log(`📋 [PATH 3 RESPONSE] Full approval object:`, JSON.stringify(approvalFetch, null, 2));
        
        const approvalData = approvalFetch as any;
        if (approvalData.whatsapp?.status) {
          approvalStatus = approvalData.whatsapp.status;
          rejectionReason = approvalData.whatsapp.rejection_reason;
          console.log(`✅ [PATH 3] Found status via ApprovalRequests endpoint: ${approvalStatus}`);
        }
      } catch (approvalError: any) {
        console.warn(`⚠️  [PATH 3] ApprovalRequests endpoint failed: ${approvalError.message}`);
      }
    }
    
    // PATH 4: Try content.approval?.status (direct approval property)
    if (!approvalStatus && (content as any).approval?.status) {
      approvalStatus = (content as any).approval.status;
      console.log(`✅ [PATH 4] Found status via content.approval.status: ${approvalStatus}`);
    }
    
    // PATH 5: Try content.status (direct status property)
    if (!approvalStatus && (content as any).status) {
      approvalStatus = (content as any).status;
      console.log(`✅ [PATH 5] Found status via content.status: ${approvalStatus}`);
    }
    
    // PATH 6: Try content.types['twilio/whatsapp'].body.approval_status
    if (!approvalStatus && content.types) {
      const types = content.types as any;
      if (types['twilio/whatsapp']?.body?.approval_status) {
        approvalStatus = types['twilio/whatsapp'].body.approval_status;
        console.log(`✅ [PATH 6] Found status via types['twilio/whatsapp'].body.approval_status: ${approvalStatus}`);
      }
    }
    
    // PATH 7: Check if template has never been submitted for approval
    if (!approvalStatus) {
      // If no approval info exists at all, template might not be submitted yet
      console.warn(`⚠️  [PATH 7] No approval status found in any path - template may not be submitted for approval`);
      approvalStatus = 'not_submitted';
    }
    
    console.log(`🎯 [FINAL STATUS] Template ${contentSid} status: ${approvalStatus}`);
    
    // Interpret the status
    // Possible values: 'approved', 'pending', 'received', 'rejected', 'paused', 'disabled'
    if (approvalStatus === 'approved') {
      return { approved: true, status: 'approved' };
    } else if (approvalStatus === 'pending' || approvalStatus === 'received') {
      // 'received' means Twilio received it and is forwarding to WhatsApp
      return { 
        approved: false, 
        status: approvalStatus,
        reason: 'Template è in attesa di approvazione WhatsApp. Controlla Twilio Console per lo status.' 
      };
    } else if (approvalStatus === 'rejected') {
      return { 
        approved: false, 
        status: 'rejected',
        reason: `Template rifiutato da WhatsApp. Motivo: ${rejectionReason || 'Nessun motivo fornito'}` 
      };
    } else if (approvalStatus === 'paused') {
      return { 
        approved: false, 
        status: 'paused',
        reason: 'Template in pausa (feedback negativo utenti) e non può essere usato' 
      };
    } else if (approvalStatus === 'disabled') {
      return { 
        approved: false, 
        status: 'disabled',
        reason: 'Template disabilitato da WhatsApp per violazioni ripetute' 
      };
    } else if (approvalStatus === 'not_submitted') {
      return { 
        approved: false, 
        status: 'not_submitted',
        reason: 'Template non ancora inviato per approvazione. Vai su Twilio Console e invia per approvazione.' 
      };
    } else {
      return { 
        approved: false, 
        status: approvalStatus || 'unknown',
        reason: `Status template sconosciuto: ${approvalStatus || 'unknown'}. Controlla Twilio Console manualmente.` 
      };
    }
  } catch (error: any) {
    console.error(`❌ [TEMPLATE VALIDATION ERROR] ${error.message}`);
    console.error(`❌ Full error:`, error);
    // If we can't check, assume not approved for safety
    return { 
      approved: false, 
      status: 'error',
      reason: `Errore nel verificare status template: ${error.message}` 
    };
  }
}
