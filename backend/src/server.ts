import type { Server } from "node:http";

import { prisma } from "./config/prisma.js";
import { env } from "./config/env.js";
import { NotificationService } from "./services/NotificationService.js";
import { ReservationReminderService } from "./services/ReservationReminderService.js";
import { SystemBootstrapService } from "./services/SystemBootstrapService.js";
import { app } from "./app.js";

const systemBootstrapService = new SystemBootstrapService(prisma);
const notificationService = new NotificationService(prisma);
const reservationReminderService = new ReservationReminderService(prisma);
const STARTUP_DB_MAX_RETRIES = env.NODE_ENV === "production" ? 5 : 1;
const STARTUP_DB_RETRY_DELAY_MS = 5_000;

let server: Server | undefined;
let shutdownInProgress = false;

const delay = (timeoutMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

const closeServer = async () => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server!.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const shutdown = async (signal: string, exitCode = 0, error?: unknown) => {
  if (shutdownInProgress) {
    return;
  }

  shutdownInProgress = true;

  if (error) {
    console.error(`[shutdown] ${signal}`, error);
  } else {
    console.info(`[shutdown] Received ${signal}. Closing backend server.`);
  }

  reservationReminderService.stop();
  notificationService.unregister();

  try {
    await closeServer();
  } catch (closeError) {
    console.error("[shutdown] Failed to close HTTP server cleanly.", closeError);
  }

  try {
    await prisma.$disconnect();
    console.info("[shutdown] Database connection closed.");
  } catch (disconnectError) {
    console.error("[shutdown] Failed to disconnect Prisma cleanly.", disconnectError);
  }

  process.exit(exitCode);
};

const connectDatabaseWithRetry = async () => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= STARTUP_DB_MAX_RETRIES; attempt += 1) {
    try {
      await prisma.$connect();
      console.info("[startup] Database connection established.");
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `[startup] Database connection attempt ${attempt} of ${STARTUP_DB_MAX_RETRIES} failed.`,
        error
      );

      if (attempt < STARTUP_DB_MAX_RETRIES) {
        await delay(STARTUP_DB_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
};

const registerProcessHandlers = () => {
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.once("uncaughtException", (error) => {
    void shutdown("uncaughtException", 1, error);
  });

  process.once("unhandledRejection", (reason) => {
    void shutdown("unhandledRejection", 1, reason);
  });
};

async function startServer() {
  await connectDatabaseWithRetry();

  const aiProviderConfigured =
    Boolean(env.AI_PROVIDER && env.AI_API_KEY && env.AI_MODEL) &&
    (env.AI_PROVIDER !== "custom" || Boolean(env.AI_API_BASE_URL));

  if (aiProviderConfigured) {
    console.info(`[startup] AI assistant provider configured: ${env.AI_PROVIDER}.`);
  } else {
    console.info(
      "[startup] AI assistant provider is not fully configured. The reservation assistant will use deterministic fallback replies."
    );
  }

  if (env.ENABLE_DEMO_BOOTSTRAP) {
    try {
      await systemBootstrapService.ensureDemoAccounts();
      console.info("[startup] Demo account bootstrap completed.");
    } catch (error) {
      console.error("[startup] Demo account bootstrap failed. Continuing startup.", error);
    }
  } else {
    console.info("[startup] Demo account bootstrap skipped.");
  }

  notificationService.register();
  reservationReminderService.start();
  console.info("[startup] Notification handlers and reminder worker started.");

  server = await new Promise<Server>((resolve, reject) => {
    const nextServer = app.listen(env.PORT, "0.0.0.0", () => {
      console.info(`[startup] Backend server running on port ${env.PORT}.`);
      console.info(`[startup] Environment: ${env.NODE_ENV}.`);
      console.info("[startup] API health check available at /api/health.");
      console.info(`[startup] Allowed client origins: ${env.CLIENT_URL}.`);
      resolve(nextServer);
    });

    nextServer.on("error", reject);
  });
}

registerProcessHandlers();

startServer().catch((error) => {
  console.error("Failed to start backend server.", error);
  void shutdown("startup failure", 1, error);
});
