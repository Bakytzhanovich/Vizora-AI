"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiLogin, apiGoogleLogin, apiRegister, apiGetMe, apiLogout } from "@/lib/api";
import type { UserProfile, RiskProfile } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  riskProfile: RiskProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    riskProfile: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const setTokens = (accessToken: string, userId: string) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("user_id", userId);
  };

  const clearTokens = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
  };

  const applyUserState = useCallback(
    ({ user, profile, risk_profile }: Awaited<ReturnType<typeof apiGetMe>>) => {
      // Sync has_profile with server truth.
      if (profile) {
        localStorage.setItem("has_profile", "true");
        localStorage.setItem("user_name", profile.name || "");
      } else {
        localStorage.removeItem("has_profile");
      }

      setState({
        user,
        profile,
        riskProfile: risk_profile,
        isAuthenticated: true,
        isLoading: false,
      });
    },
    []
  );

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    try {
      const me = await apiGetMe();
      applyUserState(me);
    } catch {
      clearTokens();
      setState({ user: null, profile: null, riskProfile: null, isAuthenticated: false, isLoading: false });
    }
  }, [applyUserState]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const register = async (email: string, password: string, referral_code?: string) => {
    const data = await apiRegister(email, password, referral_code);
    setTokens(data.access_token, data.user_id);
    if (data.referrer_name) {
      localStorage.setItem("referral_from", data.referrer_name);
    }
    await loadUser();
  };

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setTokens(data.access_token, data.user_id);
    const me = await apiGetMe();
    applyUserState(me);
    return me;
  };

  const loginWithGoogle = async (idToken: string) => {
    const data = await apiGoogleLogin(idToken);
    setTokens(data.access_token, data.user_id);
    const me = await apiGetMe();
    applyUserState(me);
    return me;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort server-side revocation; local cleanup still runs.
    }
    clearTokens();
    setState({ user: null, profile: null, riskProfile: null, isAuthenticated: false, isLoading: false });
    router.push("/login");
  };

  const refreshProfile = () => loadUser();

  return { ...state, login, loginWithGoogle, logout, register, refreshProfile };
}
