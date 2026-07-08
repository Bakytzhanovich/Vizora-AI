"use client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getStoredAdminSecret() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("adminSecret") ?? "";
}

export function setStoredAdminSecret(secret: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("adminSecret", secret);
}

export function clearStoredAdminSecret() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("adminSecret");
}

export function adminHeaders(secret: string) {
  return {
    "Content-Type": "application/json",
    "X-Admin-Secret": secret,
  };
}

async function adminFetch<T>(path: string, secret: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: adminHeaders(secret),
  });
  if (!response.ok) {
    throw new Error(response.status === 403 ? "Forbidden" : `Admin API ${response.status}`);
  }
  return response.json();
}

export function validateAdminSecret(secret: string) {
  return adminFetch<AdminSystem>("/api/admin/system", secret);
}

export function getAdminOverview(secret: string) {
  return adminFetch<AdminOverview>("/api/admin/overview", secret);
}

export function getAdminUsers(secret: string) {
  return adminFetch<AdminUsersResponse>("/api/admin/users?limit=100", secret);
}

export function getAdminAgencies(secret: string) {
  return adminFetch<AdminAgenciesResponse>("/api/admin/agencies?limit=100", secret);
}

export function getAdminManagers(secret: string) {
  return adminFetch<AdminManagersResponse>("/api/admin/managers?limit=100", secret);
}

export function getAdminAnalytics(secret: string) {
  return adminFetch<AdminAnalytics>("/api/admin/analytics", secret);
}

export function getAdminSystem(secret: string) {
  return adminFetch<AdminSystem>("/api/admin/system", secret);
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
