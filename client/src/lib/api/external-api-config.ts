import { getAuthHeaders } from "@/lib/auth";

const API_BASE = "/api/external-api";

export interface ExternalApiConfig {
  id: string;
  consultantId: string;
  configName: string;
  apiKey: string;
  baseUrl: string;
  targetCampaignId: string;
  leadType: "crm" | "marketing" | "both";
  sourceFilter?: string | null;
  campaignFilter?: string | null;
  daysFilter?: string | null;
  pollingEnabled: boolean;
  pollingIntervalMinutes: number;
  isActive: boolean;
  lastImportAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportResult {
  imported: number;
  updated: number;
  duplicates: number;
  errored: number;
  total: number;
}

export interface ImportLog {
  id: string;
  configId: string;
  triggerType: "manual" | "polling";
  status: "success" | "partial" | "error";
  leadsImported: number;
  leadsUpdated: number;
  leadsDuplicate: number;
  leadsErrored: number;
  errorMessage?: string | null;
  executedAt: string;
}

export async function fetchExternalApiConfigs() {
  const response = await fetch(`${API_BASE}/configs`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to fetch configurations" }));
    throw new Error(error.message || "Failed to fetch configurations");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to fetch configurations");
  }

  return json.data as ExternalApiConfig[];
}

export async function fetchExternalApiConfig(configId: string) {
  const response = await fetch(`${API_BASE}/configs/${configId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to fetch configuration" }));
    throw new Error(error.message || "Failed to fetch configuration");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to fetch configuration");
  }

  return json.data as ExternalApiConfig;
}

export async function createExternalApiConfig(data: Omit<ExternalApiConfig, "id" | "consultantId" | "createdAt" | "updatedAt">) {
  const response = await fetch(`${API_BASE}/configs`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to create configuration" }));
    throw new Error(error.message || "Failed to create configuration");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to create configuration");
  }

  return json.data as ExternalApiConfig;
}

export async function updateExternalApiConfig(configId: string, data: Partial<Omit<ExternalApiConfig, "id" | "consultantId" | "createdAt" | "updatedAt">>) {
  const response = await fetch(`${API_BASE}/configs/${configId}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to update configuration" }));
    throw new Error(error.message || "Failed to update configuration");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to update configuration");
  }

  return json.data as ExternalApiConfig;
}

export async function deleteExternalApiConfig(configId: string) {
  const response = await fetch(`${API_BASE}/configs/${configId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to delete configuration" }));
    throw new Error(error.message || "Failed to delete configuration");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to delete configuration");
  }

  return { success: true, message: json.message };
}

export async function testConnection(configId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/configs/${configId}/test`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    throw new Error("Failed to test connection");
  }
  
  return response.json();
}

export async function manualImport(configId: string) {
  const response = await fetch(`${API_BASE}/configs/${configId}/import`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Import failed" }));
    throw new Error(error.message || "Import failed");
  }

  const json = await response.json();
  
  return json.data as ImportResult;
}

export async function startPolling(configId: string) {
  const response = await fetch(`${API_BASE}/configs/${configId}/start-polling`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to start polling" }));
    throw new Error(error.message || "Failed to start polling");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to start polling");
  }

  return json.data;
}

export async function stopPolling(configId: string) {
  const response = await fetch(`${API_BASE}/configs/${configId}/stop-polling`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to stop polling" }));
    throw new Error(error.message || "Failed to stop polling");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to stop polling");
  }

  return json.data;
}

export async function fetchImportLogs(configId: string, limit: number = 50) {
  const response = await fetch(`${API_BASE}/configs/${configId}/logs?limit=${limit}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to fetch import logs" }));
    throw new Error(error.message || "Failed to fetch import logs");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to fetch import logs");
  }

  return json.data as ImportLog[];
}
