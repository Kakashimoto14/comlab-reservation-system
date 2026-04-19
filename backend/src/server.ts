import { prisma } from "./config/prisma.js";
import { env } from "./config/env.js";
import { SystemBootstrapService } from "./services/SystemBootstrapService.js";
import { app } from "./app.js";

const systemBootstrapService = new SystemBootstrapService(prisma);

async function startServer() {
  await prisma.$connect();
  console.info("[startup] Database connection established.");

  if (env.ENABLE_DEMO_BOOTSTRAP) {
    await systemBootstrapService.ensureDemoAccounts();
    console.info("[startup] Demo account bootstrap completed.");
  } else {
    console.info("[startup] Demo account bootstrap skipped.");
  }

  const server = app.listen(env.PORT, () => {
    console.info(`[startup] Backend server running on port ${env.PORT}.`);
    console.info(`[startup] Environment: ${env.NODE_ENV}.`);
    console.info("[startup] API health check available at /api/health.");
    console.info(`[startup] Allowed client origins: ${env.CLIENT_URL}.`);
  });

  const shutdown = async (signal: string) => {
    console.info(`[shutdown] Received ${signal}. Closing backend server.`);

    server.close(async () => {
      await prisma.$disconnect();
      console.info("[shutdown] Database connection closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

startServer().catch((error) => {
  console.error("Failed to start backend server.", error);
  process.exit(1);
});
