import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

type AuthPayload = {
  id: number;
  email: string;
  role: string;
};

export const signToken = (payload: AuthPayload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });

export const verifyToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as AuthPayload;
