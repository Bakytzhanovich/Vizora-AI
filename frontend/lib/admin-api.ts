"use client";

import { api } from "@/lib/api";

async function adminFetch<T>(path: string): Promise<T> {
  const { data } = await api.get<T>(path);
  return data;
}

export function getAdminOverview() {
  return adminFetch<AdminOverview>("/admin/overview");
}

export function getAdminUsers() {
  return adminFetch<AdminUsersResponse>("/admin/users?limit=100");
}

export function getAdminAgencies() {
  return adminFetch<AdminAgenciesResponse>("/admin/agencies?limit=100");
}

export function getAdminManagers() {
  return adminFetch<AdminManagersResponse>("/admin/managers?limit=100");
}

export function getAdminAnalytics() {
  return adminFetch<AdminAnalytics>("/admin/analytics");
}

export function getAdminSystem() {
  return adminFetch<AdminSystem>("/admin/system");
}

export interface AdminOverview {
  metrics: Record<string, number>;
  recent_users: Array<{
    email: string;
    role: string;
    name: string | null;
    created_at: string | null;
  }>;
  recent_agencies: Array<{
    name: string;
    email: string;
    plan: string;
    created_at: string | null;
  }>;
  subscription_plans: Array<{ plan: string; count: number }>;
}

export interface AdminUsersResponse {
  total: number;
  users: Array<{
    id: string;
    email: string;
    role: string;
    name: string | null;
    university: string | null;
    country: string | null;
    agency_name: string | null;
    manager_name: string | null;
    telegram_username: string | null;
    created_at: string | null;
  }>;
}

export interface AdminAgenciesResponse {
  total: number;
  agencies: Array<{
    id: string;
    name: string;
    email: string;
    country: string;
    contact_phone: string | null;
    subscription_plan: string;
    white_label_enabled: boolean;
    members_count: number;
    managers_count: number;
    pending_invites: number;
    students_count: number;
    unassigned_count: number;
    created_at: string | null;
  }>;
}

export interface AdminManagersResponse {
  total: number;
  members: Array<{
    id: string;
    role: string;
    name: string;
    email: string;
    status: string;
    agency_name: string;
    students_count: number;
    joined_at: string | null;
    last_login: string | null;
    created_at: string | null;
  }>;
}

export type RetentionDay = "d1" | "d3" | "d7" | "d14" | "d30";

export interface RetentionPoint {
  eligible: number;
  retained: number;
  rate: number | null;
}

export interface RetentionCurve {
  cohorts: Array<{
    week_start: string;
    cohort_size: number;
    points: Record<RetentionDay, RetentionPoint>;
  }>;
  overall: Record<RetentionDay, RetentionPoint>;
  eligible_users: number;
}

export interface AdminAnalytics {
  activity_14d: Array<{
    date: string;
    registrations: number;
    chat_questions: number;
    simulator_sessions: number;
    events: number;
  }>;
  funnel: Record<string, number>;
  product_usage: Record<string, number>;
  top_events: Array<{ event: string; count: number }>;
  // "cumulative" = the original metric: any activity anywhere in [signup,
  // signup+N days] — an activation metric, reads ~95%+ because one onboarding
  // action on day 0 satisfies every window forever. "classic" = real day-N
  // retention: activity specifically within day N's own window, day 0 never
  // counted. Same cohorts/eligibility gating, computed off the same data.
  retention: {
    cumulative: RetentionCurve;
    classic: RetentionCurve;
  };
  activation_funnel: {
    steps: Array<{
      event: string;
      label: string;
      count: number;
      pct_of_previous: number | null;
    }>;
  };
  entry_exit_pages: {
    total_sessions: number;
    top_entry_pages: Array<{ url: string; count: number; pct: number }>;
    top_exit_pages: Array<{ url: string; count: number; pct: number }>;
  };
}

export interface AdminSystem {
  server_time: string;
  database_provider: string;
  admin_secret_configured: boolean;
  ai_provider: string;
  ai_model: string;
  openai_configured: boolean;
  gemini_configured: boolean;
  groq_configured: boolean;
  telegram_configured: boolean;
  notification_secret_configured: boolean;
  frontend_url: string;
  allowed_origins: string[];
  scheduler_running: boolean;
  next_scraper_run: string | null;
  knowledge_base_entries: number;
  last_scraper_run: {
    status: string;
    started_at: string | null;
    completed_at: string | null;
    sources_scraped: string;
    new_entries_added: string;
    error_message: string | null;
  } | null;
}
