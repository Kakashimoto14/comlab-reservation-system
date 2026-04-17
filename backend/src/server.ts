import { prisma } from "./config/prisma.js";
import { env } from "./config/env.js";
import { SystemBootstrapService } from "./services/SystemBootstrapService.js";
import { app } from "./app.js";

const systemBootstrapService = new SystemBootstrapService(prisma);

async function startServer() {
  await systemBootstrapService.ensureDemoAccounts();

  app.listen(env.PORT, () => {
    console.log(`Backend server running on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend server.", error);
  process.exit(1);
});
