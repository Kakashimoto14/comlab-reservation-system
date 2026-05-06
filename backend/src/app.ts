import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";
import { ApiError } from "./utils/ApiError.js";

export const app = express();
app.set("trust proxy", 1);
const allowedOrigins = env.CLIENT_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const csrfProtectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const resolveRequestOrigin = (value?: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow server-to-server tools and same-origin requests without an Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS blocked for this origin."));
    }
  })
);
app.use(helmet());
app.use(cookieParser());
app.use((req, _res, next) => {
  if (!csrfProtectedMethods.has(req.method.toUpperCase())) {
    return next();
  }

  const requestOrigin =
    resolveRequestOrigin(req.get("origin")) ?? resolveRequestOrigin(req.get("referer"));

  if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
    return next();
  }

  return next(
    new ApiError(StatusCodes.FORBIDDEN, "Invalid request origin.", {
      origin: ["This request origin is not allowed."]
    })
  );
});
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);
