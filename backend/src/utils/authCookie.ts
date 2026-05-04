import type { Response } from "express";

import { env } from "../config/env.js";

const useSecureCookies =
  env.NODE_ENV === "production" || env.AUTH_COOKIE_SAME_SITE === "none";

const buildAccessCookieOptions = () => ({
  httpOnly: true,
  secure: useSecureCookies,
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  maxAge: env.AUTH_COOKIE_MAX_AGE_MS,
  path: "/"
} as const);

const buildRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: useSecureCookies,
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  maxAge: env.REFRESH_COOKIE_MAX_AGE_MS,
  path: "/"
} as const);

export const setAccessAuthCookie = (res: Response, token: string) => {
  res.cookie(env.AUTH_COOKIE_NAME, token, buildAccessCookieOptions());
};

export const setRefreshAuthCookie = (res: Response, token: string) => {
  res.cookie(env.REFRESH_COOKIE_NAME, token, buildRefreshCookieOptions());
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: env.AUTH_COOKIE_SAME_SITE,
    path: "/"
  });
  res.clearCookie(env.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: env.AUTH_COOKIE_SAME_SITE,
    path: "/"
  });
};
