import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

const normalizeApiUrl = (value: string) => {
  let normalized = value.trim();

  if (!normalized) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    normalized = normalized.replace(/\/+$/, "");

    if (!normalized.endsWith("/api")) {
      normalized = `${normalized}/api`;
    }

    return normalized;
  }

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  normalized = normalized.replace(/\/+$/, "");

  if (!normalized.endsWith("/api")) {
    normalized = `${normalized}/api`;
  }

  return normalized;
};

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const fallbackApiUrl =
  import.meta.env.DEV || import.meta.env.MODE === "test" ? "http://localhost:5000/api" : "";

if (!configuredApiUrl && import.meta.env.PROD) {
  throw new Error(
    "VITE_API_URL must be set for production builds. Use your backend URL such as https://your-backend-domain.com/api, or /api only when a reverse proxy is configured."
  );
}

const baseURL = normalizeApiUrl(configuredApiUrl || fallbackApiUrl);

export const apiBaseUrl = baseURL;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshRequest: Promise<void> | null = null;

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const shouldBypassRefresh = (config?: RetriableRequestConfig) => {
  const url = config?.url ?? "";

  return ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"].some((path) =>
    url.includes(path)
  );
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      shouldBypassRefresh(originalRequest)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    refreshRequest ??= axios
      .post(`${baseURL}/auth/refresh`, undefined, {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json"
        }
      })
      .then(() => undefined)
      .finally(() => {
        refreshRequest = null;
      });

    try {
      await refreshRequest;
      return apiClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);
