import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";

export interface SyncSource {
  id: number;
  name: string;
  description?: string;
  api_key: string;
  secret_key?: string;
  is_active: boolean;
  replace_mode: 'full' | 'append' | 'upsert';
  upsert_key_columns?: string[];
  target_dataset_id?: number;
  rate_limit_per_hour: number;
  client_id?: string;
  client_first_name?: string;
  client_last_name?: string;
  client_email?: string;
  created_at: string;
  updated_at: string;
  sync_count?: number;
  last_sync_at?: string;
}

export interface CreateSyncSourceData {
  name: string;
  description?: string;
  replaceMode?: 'full' | 'append' | 'upsert';
  upsertKeyColumns?: string;
  rateLimitPerHour?: number;
  clientId?: string;
}

export interface UpdateSyncSourceData {
  name?: string;
  description?: string;
  replaceMode?: 'full' | 'append' | 'upsert';
  upsertKeyColumns?: string;
  rateLimitPerHour?: number;
  isActive?: boolean;
}

export interface SyncSchedule {
  id: number;
  source_id: number;
  schedule_type: 'webhook_only' | 'daily' | 'weekly' | 'monthly' | 'every_x_days';
  schedule_config: Record<string, any>;
  timezone: string;
  retry_on_failure: boolean;
  max_retries: number;
  is_active: boolean;
  next_run_at?: string;
  last_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSyncScheduleData {
  sourceId: number;
  scheduleType: 'webhook_only' | 'daily' | 'weekly' | 'monthly' | 'every_x_days';
  scheduleConfig?: Record<string, any>;
  timezone?: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface UpdateSyncScheduleData {
  scheduleType?: 'webhook_only' | 'daily' | 'weekly' | 'monthly' | 'every_x_days';
  scheduleConfig?: Record<string, any>;
  timezone?: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
  isActive?: boolean;
}

export interface SyncHistoryRecord {
  id: number;
  source_id: number;
  sync_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  triggered_by: 'webhook' | 'scheduled' | 'manual';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  file_name?: string;
  file_size_bytes?: number;
  rows_imported?: number;
  rows_inserted?: number;
  rows_updated?: number;
  rows_skipped?: number;
  rows_total?: number;
  columns_detected?: number;
  columns_mapped?: string[];
  columns_unmapped?: string[];
  error_code?: string;
  error_message?: string;
  idempotency_key?: string;
  request_ip?: string;
}

export interface SyncHistoryFilters {
  sourceId?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
}

export interface SyncHistoryResponse {
  success: boolean;
  data: SyncHistoryRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface SchemaRole {
  id: string;
  name: string;
  nameIt: string;
  dataType: string;
  description: string;
  aliases: string[];
  requiredForMetrics: string[];
  autoDetectPatterns: string[];
}

export interface DatasetSyncSchema {
  success: boolean;
  version: string;
  lastUpdated: string;
  totalRoles: number;
  roleCategories: {
    critical: string[];
    document: string[];
    product: string[];
    customer: string[];
    financial: string[];
    temporal: string[];
    staff: string[];
  };
  roles: SchemaRole[];
  defaults: {
    document_type: string;
    sales_channel: string;
    time_slot_mapping: Record<string, string>;
  };
  schedulingOptions: Array<{ pattern: string; example: string }>;
}

export interface SyncStats {
  totalSources: number;
  activeSources: number;
  totalSyncs: number;
  syncsLast24h: number;
  successRate: number;
  errorsLast24h: number;
  rowsImportedTotal: number;
  avgDurationMs: number;
}

export interface TestWebhookResult {
  success: boolean;
  mode?: "quick_test" | "full_simulation";
  syncId?: string;
  datasetId?: number;
  rowsImported?: number;
  rowsSkipped?: number;
  rowsTotal?: number;
  columnsDetected?: number;
  mappingSummary?: {
    mapped: string[] | { physical: string; logical: string; confidence?: number }[];
    unmapped: string[];
  };
  error?: string;
  message?: string;
  // Quick test mode returns data inside 'data' object
  data?: {
    fileName?: string;
    fileSize?: number;
    sheetName?: string;
    totalRows?: number;
    columnsDetected?: number;
    columns?: Array<{
      physicalColumn: string;
      detectedType: string;
      suggestedLogicalColumn?: string;
      confidence?: number;
      sampleValues?: any[];
    }>;
    mappingSummary?: {
      mapped: { physical: string; logical: string; confidence?: number }[];
      unmapped: string[];
    };
    previewRows?: Record<string, any>[];
  };
}

export function useDatasetSyncSources() {
  return useQuery<{ success: boolean; data: SyncSource[] }>({
    queryKey: ["dataset-sync-sources"],
    queryFn: async () => {
      const res = await fetch("/api/dataset-sync/sources", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch sync sources");
      return res.json();
    },
  });
}

export function useCreateSyncSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSyncSourceData) => {
      return apiRequest("POST", "/api/dataset-sync/sources", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-sources"] });
    },
  });
}

export function useUpdateSyncSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateSyncSourceData }) => {
      return apiRequest("PATCH", `/api/dataset-sync/sources/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-sources"] });
    },
  });
}

export function useSyncSourceColumns(sourceId: number | null) {
  return useQuery({
    queryKey: ["dataset-sync-source-columns", sourceId],
    queryFn: async () => {
      if (!sourceId) return { columns: [] };
      const response = await fetch(`/api/dataset-sync/sources/${sourceId}/columns`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch columns");
      return response.json();
    },
    enabled: sourceId !== null,
  });
}

export function useToggleSyncSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/dataset-sync/sources/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-sources"] });
    },
  });
}

export function useDeleteSyncSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/dataset-sync/sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-sources"] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-history"] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-schedules"] });
    },
  });
}

export function useRegenerateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/dataset-sync/sources/${id}/regenerate-key`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-sources"] });
    },
  });
}

export function useDatasetSyncSchedules(sourceId?: number) {
  const params = new URLSearchParams();
  if (sourceId) params.set("sourceId", sourceId.toString());
  
  return useQuery<{ success: boolean; data: SyncSchedule[] }>({
    queryKey: ["dataset-sync-schedules", sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/dataset-sync/schedules?${params.toString()}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch sync schedules");
      return res.json();
    },
    enabled: sourceId !== undefined,
  });
}

export function useCreateSyncSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSyncScheduleData) => {
      return apiRequest("POST", `/api/dataset-sync/sources/${data.sourceId}/schedule`, {
        scheduleType: data.scheduleType,
        scheduleConfig: data.scheduleConfig,
        timezone: data.timezone,
        retryOnFailure: data.retryOnFailure,
        maxRetries: data.maxRetries,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-schedules", variables.sourceId] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-schedules"] });
    },
  });
}

export function useUpdateSyncSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sourceId, data }: { id: number; sourceId: number; data: UpdateSyncScheduleData }) => {
      return apiRequest("PATCH", `/api/dataset-sync/schedules/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-schedules", variables.sourceId] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-schedules"] });
    },
  });
}

export function useDeleteSyncSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sourceId }: { id: number; sourceId: number }) => {
      return apiRequest("DELETE", `/api/dataset-sync/schedules/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-schedules", variables.sourceId] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-schedules"] });
    },
  });
}

export function useDatasetSyncHistory(filters: SyncHistoryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.sourceId) params.set("sourceId", filters.sourceId.toString());
  if (filters.status) params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.pageSize) params.set("pageSize", filters.pageSize.toString());
  if (filters.limit) params.set("limit", filters.limit.toString());

  return useQuery<SyncHistoryResponse>({
    queryKey: ["dataset-sync-history", filters],
    queryFn: async () => {
      const url = filters.sourceId 
        ? `/api/dataset-sync/history/${filters.sourceId}?${params.toString()}`
        : `/api/dataset-sync/history?${params.toString()}`;
      
      const res = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch sync history");
      return res.json();
    },
    enabled: filters.sourceId !== undefined || Object.keys(filters).length > 0,
  });
}

export function useDatasetSyncSchema() {
  return useQuery<DatasetSyncSchema>({
    queryKey: ["dataset-sync-schema"],
    queryFn: async () => {
      const res = await fetch("/api/dataset-sync/schema", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch sync schema");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useTestWebhook() {
  const queryClient = useQueryClient();
  return useMutation<TestWebhookResult, Error, { sourceId: number; file: File; simulateFullWebhook?: boolean }>({
    mutationFn: async ({ sourceId, file, simulateFullWebhook }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceId", sourceId.toString());
      if (simulateFullWebhook) {
        formData.append("simulateFullWebhook", "true");
      }

      const token = localStorage.getItem("token");
      const res = await fetch("/api/dataset-sync/test-webhook", {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Test webhook failed" }));
        throw new Error(error.message || error.error || "Test webhook failed");
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-history", { sourceId: variables.sourceId }] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-sources"] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-stats"] });
    },
  });
}

export function useSyncStats() {
  return useQuery<{ success: boolean; data: SyncStats }>({
    queryKey: ["dataset-sync-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dataset-sync/stats", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch sync stats");
      return res.json();
    },
  });
}

export function useTriggerManualSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: number) => {
      return apiRequest("POST", `/api/dataset-sync/sources/${sourceId}/trigger`);
    },
    onSuccess: (_, sourceId) => {
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-history", { sourceId }] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-sources"] });
      queryClient.invalidateQueries({ queryKey: ["dataset-sync-stats"] });
    },
  });
}

// === SOURCE ANALYTICS HOOKS ===

export interface SourceAnalytics {
  source: {
    id: number;
    name: string;
    isActive: boolean;
    clientName: string | null;
    syncMode: 'push' | 'pull';
    createdAt: string;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    successRate7d: number;
    freshnessHours: number | null;
    freshnessStatus: 'fresh' | 'stale' | 'critical' | 'unknown';
  };
  frequency: {
    avgHoursBetweenSyncs: number | null;
    syncsLast7d: number;
    syncsLast30d: number;
  };
  metrics: {
    last7d: {
      totalSyncs: number;
      successfulSyncs: number;
      failedSyncs: number;
      totalRows: number;
      avgDurationMs: number;
    };
    last30d: {
      totalSyncs: number;
      successfulSyncs: number;
      failedSyncs: number;
      totalRows: number;
    };
  };
  lastSync: {
    syncId: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    rowsImported: number;
    durationMs: number | null;
  } | null;
  dailyTrend: Array<{
    date: string;
    syncCount: number;
    successCount: number;
    failCount: number;
    rowsImported: number;
    avgDurationMs: number;
  }>;
  recentErrors: Array<{
    error_code: string | null;
    error_message: string | null;
    started_at: string;
  }>;
}

export interface SourceOverviewItem {
  id: number;
  name: string;
  isActive: boolean;
  clientId: string | null;
  clientName: string | null;
  syncMode: 'push' | 'pull';
  replaceMode?: 'full' | 'append' | 'upsert';
  upsertKeyColumns?: string;
  healthStatus: 'healthy' | 'warning' | 'critical';
  successRate: number;
  freshnessHours: number | null;
  freshnessStatus: 'fresh' | 'stale' | 'critical' | 'unknown';
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  metrics7d: {
    syncs: number;
    success: number;
    failed: number;
    rows: number;
  };
}

export interface AnalyticsOverview {
  summary: {
    totalSources: number;
    activeSources: number;
    healthStatus: {
      healthy: number;
      warning: number;
      critical: number;
    };
    syncModes: {
      push: number;
      pull: number;
    };
  };
  sources: SourceOverviewItem[];
  byClient: Record<string, SourceOverviewItem[]>;
  noClient: SourceOverviewItem[];
}

export interface ClientAnalytics {
  id: string;
  name: string;
  email: string;
  sourceCount: number;
  activeSourceCount: number;
  syncs7d: number;
  success7d: number;
  successRate: number;
  rows7d: number;
  lastSyncAt: string | null;
  freshnessHours: number | null;
  freshnessStatus: 'fresh' | 'stale' | 'critical' | 'unknown';
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export function useSourceAnalytics(sourceId: number | null) {
  return useQuery<{ success: boolean; data: SourceAnalytics }>({
    queryKey: ["dataset-sync-source-analytics", sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/dataset-sync/sources/${sourceId}/analytics`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch source analytics");
      return res.json();
    },
    enabled: sourceId !== null,
  });
}

export function useAnalyticsOverview() {
  return useQuery<{ success: boolean; data: AnalyticsOverview }>({
    queryKey: ["dataset-sync-analytics-overview"],
    queryFn: async () => {
      const res = await fetch("/api/dataset-sync/analytics/overview", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch analytics overview");
      return res.json();
    },
  });
}

export function useClientAnalytics() {
  return useQuery<{ success: boolean; data: ClientAnalytics[] }>({
    queryKey: ["dataset-sync-client-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/dataset-sync/analytics/clients", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch client analytics");
      return res.json();
    },
  });
}
