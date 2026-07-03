import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const agencyApi = axios.create({
  baseURL: `${BASE_URL}/api/agency`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

agencyApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("agency_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function _clearAuthStorage() {
  localStorage.removeItem("agency_token");
  localStorage.removeItem("agency_id");
  localStorage.removeItem("agency_member_id");
  localStorage.removeItem("agency_role");
  localStorage.removeItem("agency_name");
  localStorage.removeItem("agency_member_name");
}

agencyApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      _clearAuthStorage();
      window.location.href = "/agency/login";
    }
    return Promise.reject(error);
  }
);

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export function getAgencyAuth() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("agency_token");
  if (!token) return null;
  return {
    token,
    agencyId: localStorage.getItem("agency_id") ?? "",
    memberId: localStorage.getItem("agency_member_id") ?? "",
    role: (localStorage.getItem("agency_role") ?? "admin") as "admin" | "manager",
    name: localStorage.getItem("agency_name") ?? "",
  };
}

function _saveAuthData(data: {
  agency_token: string;
  agency_id: string;
  member_id?: string;
  role?: string;
  name: string;
  member_name?: string;
}) {
  if (typeof window === "undefined") return;
  localStorage.setItem("agency_token", data.agency_token);
  localStorage.setItem("agency_id", data.agency_id);
  localStorage.setItem("agency_member_id", data.member_id ?? "");
  localStorage.setItem("agency_role", data.role ?? "admin");
  localStorage.setItem("agency_name", data.name);
  // member_name is the logged-in person's display name (distinct from agency company name)
  localStorage.setItem("agency_member_name", data.member_name ?? data.name);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgencyMe {
  id: string;
  name: string;
  member_name: string;
  email: string;
  country: string;
  contact_phone: string | null;
  subscription_plan: string;
  white_label_name: string | null;
  student_count: number;
  created_at: string;
  role: "admin" | "manager";
  member_id: string | null;
}

export interface AgencyStudent {
  id: string;
  email: string;
  name: string;
  university: string;
  readiness: number;
  documents_pct: number;
  simulator_sessions: number;
  simulator_avg_score: number;
  interview_date: string | null;
  days_until_interview: number | null;
  last_active: string | null;
  assigned_manager_id: string | null;
  assigned_manager_name: string | null;
}

export interface AgencyStudentDetail {
  student: {
    id: string;
    email: string;
    name: string;
    university: string;
    course_year: number;
    english_level: string;
    country: string;
    interview_date: string | null;
    financial_source: string;
    travel_history: boolean;
    via_agency: boolean;
    added_at: string;
  };
  readiness: number;
  documents_pct: number;
  simulator_sessions: number;
  simulator_avg_score: number;
  simulator_scores: { confidence: number; language: number; content: number };
  risk_profile: { type: string; level: string; description: string }[];
  roadmap_completed: string[];
  last_active: string | null;
}

export interface AgencyAlert {
  student_id: string;
  student_name: string;
  type: "critical" | "warning";
  message: string;
}

export interface WeakTopic {
  topic: string;
  avg_score: number;
  key: string;
}

export interface AgencyAnalytics {
  total_students: number;
  active_today: number;
  avg_readiness: number;
  sim_sessions_total: number;
  readiness_distribution: { high: number; medium: number; low: number };
  weak_topics: WeakTopic[];
  weekly_activity: { date: string; active_users: number }[];
  unassigned_students: number;
}

export interface AgencyTeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager";
  status: "active" | "invited" | "deactivated";
  students_count: number;
  last_login: string | null;
  joined_at: string | null;
  invited_at: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function agencyRegister(payload: {
  name: string;
  email: string;
  password: string;
  country: string;
  contact_phone?: string;
}) {
  const { data } = await agencyApi.post("/register", payload);
  _saveAuthData(data);
  return data;
}

export async function agencyLogin(email: string, password: string) {
  const { data } = await agencyApi.post("/login", { email, password });
  _saveAuthData(data);
  return data;
}

export function agencyLogout() {
  if (typeof window !== "undefined") {
    _clearAuthStorage();
    window.location.href = "/agency/login";
  }
}

// ─── Agency ───────────────────────────────────────────────────────────────────

export async function agencyGetMe(): Promise<AgencyMe> {
  const { data } = await agencyApi.get<AgencyMe>("/me");
  if (typeof window !== "undefined" && data.role) {
    localStorage.setItem("agency_role", data.role);
    if (data.member_id) localStorage.setItem("agency_member_id", data.member_id);
    if (data.member_name) localStorage.setItem("agency_member_name", data.member_name);
  }
  return data;
}

export async function agencyUpdateSettings(payload: {
  name?: string;
  contact_phone?: string;
  white_label_name?: string;
}) {
  await agencyApi.put("/settings", payload);
}

export async function agencyUpdateWhiteLabel(payload: {
  white_label_name: string;
  primary_color?: string;
  enabled: boolean;
}) {
  const { data } = await agencyApi.post("/white-label", payload);
  return data;
}

export async function agencyUploadLogo(file: File): Promise<{ logo_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await agencyApi.post<{ logo_url: string }>("/white-label/logo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ─── Students ─────────────────────────────────────────────────────────────────

export async function agencyGetStudents(
  search = "",
  sort = "name",
  managerFilter = ""
): Promise<{ students: AgencyStudent[]; total: number }> {
  const { data } = await agencyApi.get("/students", {
    params: { search, sort, manager_filter: managerFilter },
  });
  return data;
}

export async function agencyGetStudent(studentId: string): Promise<AgencyStudentDetail> {
  const { data } = await agencyApi.get<AgencyStudentDetail>(`/students/${studentId}`);
  return data;
}

export async function agencyAddStudent(email: string, name: string) {
  const { data } = await agencyApi.post<{ student_id: string; invite_link: string }>(
    "/students/add",
    { email, name }
  );
  return data;
}

export async function agencyBulkAdd(students: { email: string; name: string }[]) {
  const { data } = await agencyApi.post("/students/bulk-add", { students });
  return data;
}

// ─── Analytics & Alerts ───────────────────────────────────────────────────────

export async function agencyGetAnalytics(): Promise<AgencyAnalytics> {
  const { data } = await agencyApi.get<AgencyAnalytics>("/analytics");
  return data;
}

export async function agencyGetAlerts(): Promise<{ alerts: AgencyAlert[] }> {
  const { data } = await agencyApi.get<{ alerts: AgencyAlert[] }>("/alerts");
  return data;
}

// ─── Team management ─────────────────────────────────────────────────────────

const teamApi = axios.create({
  baseURL: `${BASE_URL}/api/agency/team`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

teamApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("agency_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

teamApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      _clearAuthStorage();
      window.location.href = "/agency/login";
    }
    return Promise.reject(error);
  }
);

export async function agencyGetTeam(): Promise<{
  members: AgencyTeamMember[];
  total_members: number;
  total_students: number;
  pending_invites: number;
}> {
  const { data } = await teamApi.get("");
  return data;
}

export async function agencyInviteMember(payload: {
  email: string;
  name: string;
  role?: string;
}): Promise<{ success: boolean; member_id: string; invite_link: string }> {
  const { data } = await teamApi.post("/invite", payload);
  return data;
}

export async function agencyDeactivateMember(
  memberId: string
): Promise<{ success: boolean; reassigned_students: number }> {
  const { data } = await teamApi.delete(`/members/${memberId}`);
  return data;
}

export async function agencyUpdateMember(
  memberId: string,
  payload: { role?: string; status?: string }
) {
  const { data } = await teamApi.put(`/members/${memberId}`, payload);
  return data;
}

export async function agencyResendInvite(
  memberId: string
): Promise<{ success: boolean; invite_link: string }> {
  const { data } = await teamApi.post("/resend-invite", { member_id: memberId });
  return data;
}

export async function agencyGetJoinInfo(token: string): Promise<{
  agency_name: string;
  invitee_name: string;
  email: string;
}> {
  const { data } = await teamApi.get("/join-info", { params: { token } });
  return data;
}

export async function agencyJoin(payload: {
  token: string;
  password: string;
  name: string;
}) {
  const { data } = await teamApi.post("/join", payload);
  _saveAuthData(data);
  return data;
}

export async function agencyGetMemberStudents(memberId: string) {
  const { data } = await teamApi.get(`/members/${memberId}/students`);
  return data;
}

export async function agencyAssignStudents(
  studentIds: string[],
  managerId: string
): Promise<{ success: boolean; assigned: number }> {
  const { data } = await teamApi.post("/assign-students", {
    student_ids: studentIds,
    manager_id: managerId,
  });
  return data;
}
