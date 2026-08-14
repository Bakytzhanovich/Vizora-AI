import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
  // Render's free tier spins the backend down after inactivity — the first
  // request after a cold start can take 15-50s+ to wake it up. A shorter
  // timeout cancels client-side before the server ever gets a chance to respond.
  timeout: 60000,
  withCredentials: true,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Shared in-flight refresh promise — every 401 across the whole app (axios
// interceptor below AND fetchWithAuth) funnels through this single call
// instead of each firing its own /auth/refresh. Without this, a page that
// fires several parallel authenticated requests on mount (dashboard loading
// profile/roadmap/documents/referral at once) would independently 401 and
// independently refresh N times for the exact same stale token — enough
// concurrent tabs/requests trips /auth/refresh's own rate limit and forces
// a spurious logout on an otherwise-valid session.
let refreshPromise: Promise<string> | null = null;

async function getRefreshedToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const { data } = await axios.post<{ access_token: string }>(
        `${BASE_URL}/api/auth/refresh`,
        {},
        { withCredentials: true }
      );
      localStorage.setItem("access_token", data.access_token);
      return data.access_token;
    } finally {
      // Clear regardless of outcome so the NEXT 401 (e.g. after this token
      // itself expires later) starts a fresh refresh rather than reusing a
      // resolved/rejected promise forever.
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// On 401 try to refresh; on failure clear storage and redirect
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // /auth/* itself issues/validates credentials — a 401 from /auth/login
    // (wrong password) or /auth/refresh (no/expired session) means "not
    // authenticated", not "token expired", so retrying it via a refresh call
    // is nonsensical: it just chains a second, unrelated 401 and then wipes
    // storage + hard-redirects the user away from the login page they're
    // already on, discarding whatever they'd typed.
    const isAuthEndpoint = typeof original?.url === "string" && original.url.startsWith("/auth/");
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isAuthEndpoint &&
      typeof window !== "undefined"
    ) {
      original._retry = true;
      try {
        const accessToken = await getRefreshedToken();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// ─── fetchWithAuth ──────────────────────────────────────────────────────────
// Wrapper around fetch() that adds Authorization header and handles 401 by
// refreshing the token (mirrors the axios interceptor above, for pages that
// use raw fetch instead of the axios instance — e.g. streaming chat).

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (typeof window === "undefined") return fetch(url, options);

  const token = localStorage.getItem("access_token");
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers, credentials: "include" });

  if (res.status !== 401) return res;

  // Try to refresh — shares the same in-flight promise as the axios
  // interceptor, so a page mixing fetchWithAuth and the api instance never
  // fires two independent refresh calls for the same stale token.
  try {
    const accessToken = await getRefreshedToken();
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(url, { ...options, headers, credentials: "include" });
  } catch {
    // fall through to redirect
  }

  // Refresh failed — wipe session and send to login
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_id");
  window.location.href = "/login";
  throw new Error("Session expired");
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function apiRegister(
  email: string,
  password: string,
  referral_code?: string
) {
  const { data } = await api.post<{
    access_token: string;
    user_id: string;
    referrer_name?: string | null;
  }>("/auth/register", { email, password, ...(referral_code ? { referral_code } : {}) });
  return data;
}

export async function apiLogin(email: string, password: string) {
  const { data } = await api.post<{
    access_token: string;
    user_id: string;
  }>("/auth/login", { email, password });
  return data;
}

export async function apiGoogleLogin(idToken: string) {
  const { data } = await api.post<{
    access_token: string;
    user_id: string;
  }>("/auth/google", { id_token: idToken });
  return data;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface OnboardingPayload {
  name: string;
  university: string;
  course_year: number;
  profession: string;
  interview_date: string | null;
  english_level: string;
  travel_history: boolean;
  financial_source: string;
  job_offer: string;
  country: string;
  via_agency: boolean;
}

export interface RiskItem {
  type: string;
  severity: "high" | "medium" | "low";
  label_ru: string;
  advice_ru: string;
  focus_questions?: string[];
  note?: string;
}

export interface RiskProfile {
  risks: RiskItem[];
  overall_risk: "high" | "medium" | "low";
}

export interface UserProfile {
  id: string;
  name: string;
  university: string;
  course_year: number;
  profession: string;
  interview_date: string | null;
  english_level: string;
  travel_history: boolean;
  financial_source: string;
  job_offer: string;
  country: string;
  via_agency: boolean;
}

export async function apiOnboarding(payload: OnboardingPayload) {
  try {
    const { data } = await api.post<{ profile: UserProfile; risk_profile: RiskProfile }>(
      "/profile/onboarding",
      payload
    );
    return data;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "response" in err) {
      const axiosErr = err as { response: { data: unknown; status: number } };
      console.error("422 detail:", JSON.stringify(axiosErr.response.data, null, 2));
    }
    throw err;
  }
}

export interface SubscriptionBanner {
  type: "warning" | "danger" | "urgent";
  color: "yellow" | "orange" | "red";
  message: string;
  cta: string;
  cta_url: string;
  show_discount?: boolean;
}

// "past_due" is the only reachable non-"active" status now — a failed Kaspi
// renewal charge on an existing paid plan. FREE is permanent, not a trial, so
// there's no "trial"/"expired" state to represent anymore.
export type SubscriptionStatus = "active" | "past_due";
export type SubscriptionPlan =
  | "free"
  | "standard"
  | "premium"
  | "agency_starter"
  | "agency_business"
  | "agency_partner";

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  limits: PlanLimits;
  period_end: string | null;
  sessions_used: number | null;
  sessions_limit: number | null;
  banner: SubscriptionBanner | null;
}

export async function apiGetMe() {
  const { data } = await api.get<{
    user: { id: string; email: string; role: string; language: string };
    profile: UserProfile | null;
    risk_profile: RiskProfile | null;
    subscription: SubscriptionInfo;
  }>("/profile/me");
  return data;
}

export async function apiUpdateLanguage(language: "ru" | "kz") {
  const { data } = await api.post<{ success: boolean; language: string }>(
    "/profile/language",
    { language }
  );
  return data;
}

export async function apiLogout() {
  await api.post("/auth/logout");
}

// ─── Documents ────────────────────────────────────────────────────────────────

export interface DocumentItem {
  id: string;
  name: string;
  description: string;
  required: boolean;
  category: string;
  tips: string;
  risk_note: string | null;
  completed: boolean;
}

export interface DS160Step {
  step: number;
  title: string;
  description: string;
  important: string | null;
  warning: string | null;
}

export interface CommonMistake {
  mistake: string;
  consequence: string;
  solution: string;
}

export async function apiGetChecklist() {
  const { data } = await api.get<{ checklist: DocumentItem[]; progress: number }>(
    "/documents/checklist"
  );
  return data;
}

export async function apiUpdateDocument(document_id: string, completed: boolean) {
  const { data } = await api.post<{ success: boolean; progress: number }>(
    "/documents/checklist/update",
    { document_id, completed }
  );
  return data;
}

export async function apiGetDS160Guide() {
  const { data } = await api.get<{ steps: DS160Step[] }>("/documents/ds160-guide");
  return data;
}

export async function apiGetCommonMistakes() {
  const { data } = await api.get<{ mistakes: CommonMistake[] }>("/documents/common-mistakes");
  return data;
}

// ─── Roadmap ─────────────────────────────────────────────────────────────────

export type RoadmapStatus = "pending" | "in_progress" | "completed";

export interface RoadmapStepData {
  id: string;
  number: number;
  title: string;
  description: string;
  category: string;
  tips: string;
  auto_complete: boolean;
  status: RoadmapStatus;
  completed_at: string | null;
}

export interface RoadmapResponse {
  steps: RoadmapStepData[];
  current_step: string | null;
  progress: number;
}

export async function apiGetRoadmap() {
  const { data } = await api.get<RoadmapResponse>("/roadmap/roadmap");
  return data;
}

export async function apiUpdateRoadmapStep(step_id: string, status: RoadmapStatus) {
  const { data } = await api.post<{ success: boolean; next_step: string | null }>(
    "/roadmap/roadmap/update",
    { step_id, status }
  );
  return data;
}

// ─── Emergency ────────────────────────────────────────────────────────────────

export interface EmergencyScenario {
  id: string;
  title: string;
  icon: string;
  description: string;
  urgency: "critical" | "high" | "medium";
  total_steps: number;
}

export interface EmergencyStep {
  id: string;
  question: string;
  options: string[];
}

export interface EmergencyContact {
  name: string;
  phone?: string;
  description: string;
  note?: string;
  priority: "emergency" | "first" | "secondary";
}

export interface EmergencyActionPlan {
  steps: string[];
  urgency: "critical" | "high" | "medium";
  contacts: EmergencyContact[];
  disclaimer: string;
}

export interface EmergencyStartResponse {
  session_id: string;
  scenario: { id: string; title: string; icon: string; urgency: string };
  step: EmergencyStep;
  step_index: number;
  total_steps: number;
  completed: false;
}

export interface EmergencyRespondResponse {
  step: EmergencyStep | null;
  step_index: number;
  total_steps: number;
  completed: boolean;
  action_plan: EmergencyActionPlan | null;
}

export async function apiGetEmergencyScenarios() {
  const { data } = await api.get<{ scenarios: EmergencyScenario[] }>("/emergency/scenarios");
  return data;
}

export async function apiStartEmergency(scenario_id: string) {
  const { data } = await api.post<EmergencyStartResponse>("/emergency/start", { scenario_id });
  return data;
}

export async function apiRespondEmergency(
  session_id: string,
  step_index: number,
  answer: string
) {
  const { data } = await api.post<EmergencyRespondResponse>("/emergency/respond", {
    session_id,
    step_index,
    answer,
  });
  return data;
}

// ─── Referral ─────────────────────────────────────────────────────────────────

export interface ReferralTier {
  referrals_needed: number;
  reward: string;
  reward_type: string;
  reward_value: number | null;
}

export interface ReferralReward {
  reward_type: string;
  description: string;
  status: "earned" | "claimed" | "expired";
}

export interface ReferralStats {
  total_invited: number;
  total_registered: number;
  total_active: number;
  rewards: ReferralReward[];
  next_tier: ReferralTier | null;
  tiers: ReferralTier[];
}

export interface ReferralCodeResponse {
  code: string;
  link: string;
  stats: ReferralStats;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  count: number;
  is_me: boolean;
}

export async function apiGetReferralCode() {
  const { data } = await api.get<ReferralCodeResponse>("/referral/my-code");
  return data;
}

export async function apiGetReferralStats() {
  const { data } = await api.get<{
    total_invited: number;
    total_registered: number;
    total_active: number;
    rewards_earned: ReferralReward[];
    pending_rewards: ReferralTier[];
    next_tier: ReferralTier | null;
  }>("/referral/stats");
  return data;
}

export async function apiGetReferralLeaderboard() {
  const { data } = await api.get<{ top_referrers: LeaderboardEntry[] }>(
    "/referral/leaderboard"
  );
  return data;
}

export async function apiApplyReferralCode(referral_code: string) {
  const { data } = await api.post<{ success: boolean; referrer_name: string }>(
    "/referral/apply",
    { referral_code }
  );
  return data;
}

// ─── After Visa ──────────────────────────────────────────────────────────────

export interface AfterVisaModuleSummary {
  id: string;
  icon: string;
  title: string;
  description: string;
  section_count: number;
  completed: number;
  total: number;
  pct: number;
}

export interface AfterVisaModulesResponse {
  unlocked: boolean;
  modules: AfterVisaModuleSummary[];
  overall_completed: number;
  overall_total: number;
  overall_pct: number;
}

export interface AfterVisaSection {
  id: string;
  title: string;
  content: string;
  completed: boolean;
}

export interface AfterVisaModuleDetail {
  id: string;
  icon: string;
  title: string;
  description: string;
  sections: AfterVisaSection[];
}

export interface AfterVisaContentResponse {
  module: AfterVisaModuleDetail;
  completed: number;
  total: number;
  pct: number;
}

export async function apiGetAfterVisaModules() {
  const { data } = await api.get<AfterVisaModulesResponse>("/after-visa/modules");
  return data;
}

export async function apiGetAfterVisaContent(module_id: string) {
  const { data } = await api.get<AfterVisaContentResponse>(
    `/after-visa/content/${module_id}`
  );
  return data;
}

export async function apiUpdateAfterVisaProgress(
  module_id: string,
  section_id: string,
  completed: boolean
) {
  const { data } = await api.post<{ success: boolean; overall_progress: number }>(
    "/after-visa/progress",
    { module_id, section_id, completed }
  );
  return data;
}

export async function apiResolveEmergency(session_id: string) {
  const { data } = await api.post<{ success: boolean }>("/emergency/resolve", { session_id });
  return data;
}

// ─── Payments (Kaspi Pay) ───────────────────────────────────────────────────

export interface PlanLimits {
  faq_per_day: number | null;
  simulator_sessions_total: number | null;
  simulator_sessions_per_month: number | null;
  simulator_session_max_minutes: number | null;
  consul_mode: boolean;
  detailed_feedback: boolean;
  risk_solutions: boolean;
  after_visa: boolean;
  emergency: boolean;
  ds160_guide: boolean;
  pdf_report: boolean;
  priority_support: boolean;
}

export interface Plan {
  id: string;
  name: string;
  prices_kzt: { monthly: number; yearly: number };
  limits: PlanLimits;
}

export async function apiGetPlans() {
  const { data } = await api.get<{
    plans: Plan[];
    upgrade_discount_code: string;
    upgrade_discount_rate: number;
  }>("/payments/plans");
  return data;
}

export async function apiGetSocialProof() {
  const { data } = await api.get<{ student_count: number; average_score: number | null }>(
    "/payments/social-proof"
  );
  return data;
}

export interface CreatePaymentResponse {
  payment_id: string;
  pay_url: string;
  amount: number;
  currency: string;
  discount_applied: boolean;
  mock_mode: boolean;
}

export async function apiCreatePayment(
  plan: string,
  billing_period: "monthly" | "yearly" = "monthly",
  discount_code?: string
) {
  const { data } = await api.post<CreatePaymentResponse>("/payments/create-payment", {
    plan,
    billing_period,
    ...(discount_code ? { discount_code } : {}),
  });
  return data;
}

export async function apiMockCompletePayment(payment_id: string) {
  const { data } = await api.post<{ received: boolean; status: string }>(
    `/payments/mock-complete/${payment_id}`
  );
  return data;
}

export interface PaymentStatus {
  plan: SubscriptionPlan;
  period_end: string | null;
  sessions_used?: number;
  sessions_limit?: number | null;
  sessions_ok?: boolean;
  limits: PlanLimits;
  billing_period: "monthly" | "yearly" | null;
}

export async function apiGetPaymentStatus() {
  const { data } = await api.get<PaymentStatus>("/payments/status");
  return data;
}
