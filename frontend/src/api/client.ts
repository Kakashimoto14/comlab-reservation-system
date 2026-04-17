import axios from "axios";

import { readStoredAuth } from "../utils/authStorage";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const storedAuth = readStoredAuth();

  if (storedAuth?.token) {
    config.headers.Authorization = `Bearer ${storedAuth.token}`;
  }

  return config;
});
