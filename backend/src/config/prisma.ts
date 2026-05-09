import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import path from "path";

import { env } from "./env.js";

function buildDatabaseUrl() {
  const databaseUrl = new URL(env.DATABASE_URL);

  const isMysql = databaseUrl.protocol.startsWith("mysql");

  if (!isMysql) {
    return env.DATABASE_URL;
  }

  // LOCAL DEVELOPMENT
  // Do not force SSL on localhost
  const isLocalhost =
    databaseUrl.hostname === "localhost" ||
    databaseUrl.hostname === "127.0.0.1";

  if (isLocalhost) {
    return env.DATABASE_URL;
  }

  // PRODUCTION SSL
  const certificatePath =
    env.DATABASE_SSL_CERT_PATH ??
    path.resolve(process.cwd(), "prisma", "ca-certificate.crt");

  if (!existsSync(certificatePath)) {
    return env.DATABASE_URL;
  }

  databaseUrl.searchParams.set(
    "sslaccept",
    env.DATABASE_SSL_ACCEPT ?? "strict"
  );

  databaseUrl.searchParams.set("sslcert", certificatePath);

  return databaseUrl.toString();
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: buildDatabaseUrl(),
      },
    },
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}