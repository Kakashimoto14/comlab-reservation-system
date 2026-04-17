import type { User } from "../types/api";
import { STORAGE_KEY } from "./constants";

type StoredAuth = {
  token: string;
  user: User;
};

export const readStoredAuth = (): StoredAuth | null => {
  const rawValue = localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StoredAuth>;

    if (
      typeof parsedValue.token !== "string" ||
      !parsedValue.token ||
      !parsedValue.user ||
      typeof parsedValue.user !== "object"
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsedValue as StoredAuth;
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const writeStoredAuth = (value: StoredAuth) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const clearStoredAuth = () => {
  localStorage.removeItem(STORAGE_KEY);
};
