import type { Response } from "express";

import { env } from "../config/env.js";

const buildCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  maxAge: env.AUTH_COOKIE_MAX_AGE_MS,
  path: "/"
} as const);

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(env.AUTH_COOKIE_NAME, token, buildCookieOptions());
};

export const clearAuthCookie = (res: Response) => {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.AUTH_COOKIE_SAME_SITE,
    path: "/"
  });
};
