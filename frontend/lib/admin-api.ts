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
