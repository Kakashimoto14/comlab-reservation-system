import axios from "axios";

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
const fallbackApiUrl = import.meta.env.DEV
  ? "http://localhost:5000/api"
  : "/api";

if (!configuredApiUrl && !import.meta.env.DEV) {
  console.warn(
    "VITE_API_URL is not set for production. Falling back to same-origin /api."
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
