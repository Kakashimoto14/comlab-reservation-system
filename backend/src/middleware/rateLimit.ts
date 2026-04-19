import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
  message: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const getClientIp = (req: Request) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length) {
    return forwardedFor[0]?.trim() || "unknown";
  }

  return req.ip || "unknown";
};

const cleanupExpiredBuckets = (now: number) => {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });
};

export const createRateLimiter = ({
  keyPrefix,
  windowMs,
  maxRequests,
  message
}: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const key = `${keyPrefix}:${getClientIp(req)}`;
    const currentBucket = buckets.get(key);

    if (!currentBucket || currentBucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return next();
    }

    if (currentBucket.count >= maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((currentBucket.resetAt - now) / 1000)
      );

      res.setHeader("Retry-After", retryAfterSeconds.toString());
      return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        message
      });
    }

    currentBucket.count += 1;
    buckets.set(key, currentBucket);
    return next();
  };
};
