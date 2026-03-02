import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { systemSettings } from "@shared/schema";
import fs from "fs";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

let cachedConfig: { apiKey: string; connectionId: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000;

export async function getTelnyxConfig(): Promise<{ apiKey: string; connectionId: string }> {
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const [apiKeySetting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "telnyx_api_key"))
    .limit(1);

  const [connectionIdSetting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "telnyx_ip_connection_id"))
    .limit(1);

  cachedConfig = {
    apiKey: (apiKeySetting?.value as string) || "",
    connectionId: (connectionIdSetting?.value as string) || "",
  };
  cacheTimestamp = now;
  return cachedConfig;
}

export function clearTelnyxConfigCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}

export async function isTelnyxConfigured(): Promise<boolean> {
  const config = await getTelnyxConfig();
  return !!(config.apiKey && config.connectionId);
}

function telnyxHeaders(apiKey: string) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function telnyxRequest(endpoint: string, options: any = {}, overrideApiKey?: string) {
  const config = await getTelnyxConfig();
  const apiKey = overrideApiKey || config.apiKey;
  if (!apiKey) {
    throw new Error("Telnyx API key non configurata. Configurala dal pannello Super Admin → Impostazioni → VPS/Voice.");
  }
  const url = `${TELNYX_API_BASE}${endpoint}`;
  const headers = telnyxHeaders(apiKey);
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const data = await response.json() as any;
  if (!response.ok) {
    const errorMsg = data?.errors?.[0]?.detail || data?.message || JSON.stringify(data);
    throw new Error(`Telnyx API error (${response.status}): ${errorMsg}`);
  }
  return data;
}

async function updateRequestStatus(requestId: number, status: string, extraFields: Record<string, any> = {}) {
  const setClauses = [sql`status = ${status}`, sql`updated_at = NOW()`];
  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined) {
      setClauses.push(sql`${sql.raw(key)} = ${value}`);
    }
  }
  await db.execute(sql`
    UPDATE voip_provisioning_requests
    SET ${sql.join(setClauses, sql`, `)}
    WHERE id = ${requestId}
  `);
}

async function appendErrorLog(requestId: number, error: string) {
  await db.execute(sql`
    UPDATE voip_provisioning_requests
    SET error_log = COALESCE(error_log, '') || ${`[${new Date().toISOString()}] ${error}\n`},
        updated_at = NOW()
    WHERE id = ${requestId}
  `);
}

export async function testConnection(): Promise<{ success: boolean; balance?: string; currency?: string; error?: string }> {
  try {
    const data = await telnyxRequest("/balance");
    return {
      success: true,
      balance: data.data?.balance || "0.00",
      currency: data.data?.currency || "USD",
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createManagedAccount(businessName: string, email: string): Promise<{ id: string; apiKey: string }> {
  console.log(`[TELNYX] Creating managed account for: ${businessName}`);
  const data = await telnyxRequest("/managed_accounts", {
    method: "POST",
    body: JSON.stringify({
      business_name: businessName,
      email: email,
      managed_account_allow_custom_pricing: false,
      rollup_billing: true,
    }),
  });
  const account = data.data;
  return {
    id: account.id,
    apiKey: account.api_key,
  };
}

export async function getManagedAccountBalance(accountId: string): Promise<{ balance: string; currency: string; status: string }> {
  const data = await telnyxRequest(`/managed_accounts/${accountId}`);
  const account = data.data;
  return {
    balance: account.balance?.amount || "0.00",
    currency: account.balance?.currency || "USD",
    status: account.status || "unknown",
  };
}

export async function createRequirementGroup(countryCode: string, phoneNumberType: string, action: string): Promise<string> {
  console.log(`[TELNYX] Creating requirement group: country=${countryCode}, type=${phoneNumberType}, action=${action}`);
  const data = await telnyxRequest("/requirement_groups", {
    method: "POST",
    body: JSON.stringify({
      country_code: countryCode,
      phone_number_type: phoneNumberType,
      action: action,
    }),
  });
  return data.data.id;
}

export async function fulfillRequirements(groupId: string, documents: Array<{ documentId: string; requirementTypeId: string }>, businessData: Record<string, any>): Promise<void> {
  console.log(`[TELNYX] Fulfilling requirements for group: ${groupId}`);
  const requirementsFulfillment = documents.map(doc => ({
    requirement_type_id: doc.requirementTypeId,
    document_id: doc.documentId,
  }));
  await telnyxRequest(`/requirement_groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({
      requirements_fulfillment: requirementsFulfillment,
      ...businessData,
    }),
  });
}

export async function submitForApproval(groupId: string): Promise<void> {
  console.log(`[TELNYX] Submitting requirement group for approval: ${groupId}`);
  await telnyxRequest(`/requirement_groups/${groupId}/submit_for_approval`, {
    method: "POST",
  });
}

export async function searchAvailableNumbers(prefix: string, countryCode: string = "IT"): Promise<Array<{ phoneNumber: string; features: any }>> {
  console.log(`[TELNYX] Searching numbers: prefix=${prefix}, country=${countryCode}`);
  const params = new URLSearchParams({
    "filter[country_code]": countryCode,
    "filter[phone_number][starts_with]": prefix,
    "filter[limit]": "20",
  });
  const data = await telnyxRequest(`/available_phone_numbers?${params.toString()}`);
  return (data.data || []).map((n: any) => ({
    phoneNumber: n.phone_number,
    features: n.features || [],
  }));
}

export async function orderNumber(phoneNumber: string, connectionIdOverride?: string, requirementGroupId?: string): Promise<string> {
  console.log(`[TELNYX] Ordering number: ${phoneNumber}`);
  const config = await getTelnyxConfig();
  const connectionId = connectionIdOverride || config.connectionId;
  if (!connectionId) {
    throw new Error("Telnyx IP Connection ID non configurato. Configuralo dal pannello Super Admin → Impostazioni → VPS/Voice.");
  }
  const body: any = {
    phone_numbers: [{ phone_number: phoneNumber }],
    connection_id: connectionId,
  };
  if (requirementGroupId) {
    body.requirement_group_id = requirementGroupId;
  }
  const data = await telnyxRequest("/number_orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.data.id;
}

export async function checkOrderStatus(orderId: string): Promise<{ status: string; phoneNumbers: any[] }> {
  const data = await telnyxRequest(`/number_orders/${orderId}`);
  return {
    status: data.data.status,
    phoneNumbers: data.data.phone_numbers || [],
  };
}

export async function checkRequirementStatus(groupId: string): Promise<{ status: string; requirements: any[] }> {
  const data = await telnyxRequest(`/requirement_groups/${groupId}`);
  return {
    status: data.data.status,
    requirements: data.data.requirements || [],
  };
}

export async function allocateOutboundChannels(accountId: string, channels: number): Promise<void> {
  console.log(`[TELNYX] Allocating ${channels} outbound channels for account: ${accountId}`);
  await telnyxRequest(`/managed_accounts/${accountId}/outbound_channels`, {
    method: "PATCH",
    body: JSON.stringify({
      channels: channels,
    }),
  });
}

export async function uploadDocumentToTelnyx(filePath: string, fileName: string): Promise<string> {
  console.log(`[TELNYX] Uploading document: ${fileName}`);
  const config = await getTelnyxConfig();
  if (!config.apiKey) {
    throw new Error("Telnyx API key non configurata.");
  }
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer]);
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const response = await fetch(`${TELNYX_API_BASE}/documents`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: formData,
  });
  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(`Telnyx document upload error: ${data?.errors?.[0]?.detail || JSON.stringify(data)}`);
  }
  return data.data.id;
}

export async function runFullProvisioningFlow(requestId: number): Promise<void> {
  try {
    const configured = await isTelnyxConfigured();
    if (!configured) {
      throw new Error("Telnyx non configurato. API Key e Connection ID devono essere impostati nel pannello Super Admin.");
    }

    const reqResult = await db.execute(sql`
      SELECT * FROM voip_provisioning_requests WHERE id = ${requestId}
    `);
    if (reqResult.rows.length === 0) throw new Error("Request not found");
    const request = reqResult.rows[0] as any;

    if (request.provider !== "telnyx") {
      console.log(`[TELNYX] Skipping provisioning for non-telnyx provider: ${request.provider}`);
      return;
    }

    if (!request.telnyx_managed_account_id) {
      const account = await createManagedAccount(
        request.business_name || "Consultant",
        request.contact_email || ""
      );
      await updateRequestStatus(requestId, "documents_uploaded", {
        telnyx_managed_account_id: account.id,
        telnyx_managed_account_api_key: account.apiKey,
      });
    }

    if (!request.telnyx_requirement_group_id) {
      const groupId = await createRequirementGroup("IT", "local", "ordering");
      await updateRequestStatus(requestId, "kyc_submitted", {
        telnyx_requirement_group_id: groupId,
      });
    }

    console.log(`[TELNYX] Full provisioning flow completed for request ${requestId}`);
  } catch (error: any) {
    console.error(`[TELNYX] Provisioning error for request ${requestId}:`, error.message);
    await appendErrorLog(requestId, error.message);
    throw error;
  }
}

export async function getProvisioningStatus(consultantId: string) {
  const result = await db.execute(sql`
    SELECT r.*, 
      (SELECT json_agg(d.*) FROM voip_provisioning_documents d WHERE d.request_id = r.id) as documents
    FROM voip_provisioning_requests r
    WHERE r.consultant_id = ${consultantId}
    ORDER BY r.created_at DESC
    LIMIT 1
  `);
  return result.rows[0] || null;
}
