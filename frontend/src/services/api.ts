import axios from "axios";
import type { ApiResponse, TokenResponse } from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 120_000,
  headers: { "Content-Type": "application/json" },
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        pendingQueue.push((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) throw new Error("no refresh token");

      const { data } = await axios.post<ApiResponse<TokenResponse>>(
        `${api.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken },
      );

      if (data.code !== 0 || !data.data) throw new Error(data.message);

      const newAccess = data.data.access_token;
      setAccessToken(newAccess);
      localStorage.setItem("refresh_token", data.data.refresh_token);

      pendingQueue.forEach((cb) => cb(newAccess));
      pendingQueue = [];

      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch {
      setAccessToken(null);
      localStorage.removeItem("refresh_token");
      window.location.href = "/";
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
