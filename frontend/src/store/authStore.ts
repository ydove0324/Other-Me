import { create } from "zustand";
import api, { setAccessToken } from "../services/api";
import type { ApiResponse, UserInfo } from "../types";

interface AuthState {
  accessToken: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  loading: boolean;

  loginWithGoogle: () => void;
  handleOAuthCallback: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  loading: true,

  loginWithGoogle: () => {
    window.location.href = `${api.defaults.baseURL}/auth/oauth/google/authorize`;
  },

  handleOAuthCallback: async (accessToken, refreshToken) => {
    setAccessToken(accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ accessToken, isAuthenticated: true });

    try {
      const { data } = await api.get<ApiResponse<UserInfo>>("/auth/me");
      if (data.code === 0 && data.data) {
        set({ user: data.data });
      }
    } catch {
      // user fetch failed but tokens are set
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      } catch {
        /* best effort */
      }
    }
    setAccessToken(null);
    localStorage.removeItem("refresh_token");
    set({ accessToken: null, user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      set({ loading: false });
      return;
    }

    try {
      const { data: refreshData } = await api.post<ApiResponse<{ access_token: string; refresh_token: string; user: UserInfo }>>(
        "/auth/refresh",
        { refresh_token: refreshToken },
      );

      if (refreshData.code === 0 && refreshData.data) {
        setAccessToken(refreshData.data.access_token);
        localStorage.setItem("refresh_token", refreshData.data.refresh_token);
        set({
          accessToken: refreshData.data.access_token,
          isAuthenticated: true,
          user: refreshData.data.user,
          loading: false,
        });
        return;
      }
    } catch {
      // token refresh failed
    }

    setAccessToken(null);
    localStorage.removeItem("refresh_token");
    set({ loading: false, isAuthenticated: false });
  },

  reset: () => {
    setAccessToken(null);
    localStorage.removeItem("refresh_token");
    set({ accessToken: null, user: null, isAuthenticated: false, loading: false });
  },
}));
