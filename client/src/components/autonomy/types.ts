export interface AutonomySettings {
  is_active: boolean;
  autonomy_level: number;
  default_mode: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  max_daily_calls: number;
  max_daily_emails: number;
  max_daily_whatsapp: number;
  max_daily_analyses: number;
  channels_enabled: {
    voice: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  allowed_task_categories: string[];
  custom_instructions: string;
  proactive_check_interval_minutes: number;
  role_frequencies: Record<string, string>;
}

export interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  severity: "info" | "success" | "warning" | "error";
  created_at: string;
  contact_name?: string;
  is_read: boolean;
  event_data?: any;
  ai_role?: string;
  event_type?: string;
  cycle_id?: string;
}

export interface PersonalizzaConfig {
  custom_name: string;
  detailed_instructions: string;
  preferred_channels: string[];
  task_categories: string[];
  client_segments: string;
  analysis_frequency: string;
  tone_of_voice: string;
  max_tasks_per_run: number;
  priority_rules: string;
}

export interface MarcoObjective {
  id: string;
  name: string;
  deadline: string | null;
  priority: 'alta' | 'media' | 'bassa';
  description?: string;
}

export interface MarcoContext {
  objectives: MarcoObjective[];
  roadmap: string;
  linkedKbDocumentIds: string[];
  reportStyle: 'sintetico' | 'dettagliato' | 'bilanciato';
  reportFocus: string;
  consultantPhone: string;
  consultantEmail: string;
  consultantWhatsapp: string;
}

export interface KbDocument {
  id: string;
  title: string;
  category: string;
  file_type: string;
  status: string;
  file_size: number;
  created_at: string;
}

export interface ActivityResponse {
  activities: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskStepPlan {
  step: number;
  action: string;
  description: string;
  status: string;
}

export interface AITask {
  id: string;
  ai_instruction: string;
  status: string;
  task_category: string;
  origin_type: string;
  priority: number;
  contact_name?: string;
  ai_reasoning?: string;
  ai_confidence?: number;
  execution_plan?: TaskStepPlan[];
  result_summary?: string;
  result_data?: any;
  scheduled_at?: string;
  completed_at?: string;
  created_at: string;
  ai_role?: string;
}

export interface TasksResponse {
  tasks: AITask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TasksStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  pending: number;
  role_counts?: Array<{role: string, count: number}>;
  manual_count?: number;
}

export interface TaskDetailResponse {
  task: AITask;
  activity: ActivityItem[];
}

export interface SystemStatus {
  is_active: boolean;
  autonomy_level: number;
  is_in_working_hours: boolean;
  is_working_day: boolean;
  is_within_hours: boolean;
  current_time_rome: string;
  today_counts: { calls: number; emails: number; whatsapp: number; analyses: number };
  limits: { max_calls: number; max_emails: number; max_whatsapp: number; max_analyses: number };
  last_autonomous_check: string | null;
  last_check_data: any;
  next_check_estimate: string | null;
  check_interval_minutes: number;
  eligible_clients: number;
  total_clients: number;
  pending_tasks: number;
  cron_schedule: string;
  task_execution_schedule: string;
  last_error: { created_at: string; title: string; description: string; data: any } | null;
  roles?: Array<{
    id: string;
    name: string;
    displayName: string;
    avatar: string;
    accentColor: string;
    description: string;
    shortDescription: string;
    categories: string[];
    preferredChannels: string[];
    enabled: boolean;
    last_task_at: string | null;
    total_tasks_30d: number;
  }>;
  enabled_roles?: Record<string, boolean>;
}

export interface AutonomousLog {
  id: string;
  event_type: string;
  title: string;
  description: string;
  icon: string;
  severity: string;
  created_at: string;
  event_data: any;
  contact_name: string | null;
  task_id: string | null;
  ai_role: string | null;
}

export interface AutonomousLogsResponse {
  logs: AutonomousLog[];
  total: number;
  page: number;
  limit: number;
}

export interface NewTaskData {
  ai_instruction: string;
  task_category: string;
  priority: number;
  contact_name: string;
  contact_phone: string;
  client_id: string;
  preferred_channel: string;
  tone: string;
  urgency: string;
  scheduled_datetime: string;
  objective: string;
  additional_context: string;
  voice_template_suggestion: string;
  language: string;
}

export interface TaskLibraryItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  category: string;
  instruction: string;
  preferred_channel?: string;
  tone?: string;
  urgency?: string;
  objective?: string;
  priority?: number;
  voice_template_suggestion?: string;
}
