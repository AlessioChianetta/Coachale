import { getAuthHeaders } from "@/lib/auth";
import type { InsertMarketingCampaign, UpdateMarketingCampaign } from "@db/schema";

const API_BASE = "/api/campaigns";

export async function fetchCampaigns(activeOnly?: boolean) {
  const url = activeOnly ? `${API_BASE}?active=true` : API_BASE;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to fetch campaigns" }));
    throw new Error(error.message || "Failed to fetch campaigns");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to fetch campaigns");
  }
  
  // Normalize: return { campaigns, count } for consumers
  return {
    campaigns: json.data,
    count: json.count ?? json.data.length
  };
}

export async function fetchCampaign(id: string) {
  const response = await fetch(`${API_BASE}/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to fetch campaign" }));
    throw new Error(error.message || "Failed to fetch campaign");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to fetch campaign");
  }
  
  // Return campaign directly
  return json.data;
}

export async function createCampaign(data: Omit<InsertMarketingCampaign, "consultantId">) {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to create campaign" }));
    throw new Error(error.message || "Failed to create campaign");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to create campaign");
  }
  
  // Return campaign directly (mutations resolve to domain object)
  return json.data;
}

export async function updateCampaign(id: string, data: UpdateMarketingCampaign) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to update campaign" }));
    throw new Error(error.message || "Failed to update campaign");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to update campaign");
  }
  
  // Return campaign directly
  return json.data;
}

export async function deleteCampaign(id: string) {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to delete campaign" }));
    throw new Error(error.message || "Failed to delete campaign");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to delete campaign");
  }
  
  // Return soft delete info for UI distinction
  return {
    softDeleted: json.softDeleted,
    message: json.message
  };
}

export async function fetchCampaignAnalytics(id: string) {
  const response = await fetch(`${API_BASE}/${id}/analytics`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to fetch campaign analytics" }));
    throw new Error(error.message || "Failed to fetch campaign analytics");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to fetch campaign analytics");
  }
  
  // Normalize for charting and pagination
  return {
    analytics: json.data,
    count: json.count ?? json.data.length
  };
}

export async function fetchCampaignWithLeads(id: string) {
  const response = await fetch(`${API_BASE}/${id}/leads`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to fetch campaign with leads" }));
    throw new Error(error.message || "Failed to fetch campaign with leads");
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to fetch campaign with leads");
  }
  
  // Split compound payload for clarity
  const { leads, ...campaign } = json.data;
  return {
    campaign,
    leads: leads || []
  };
}
