import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";

import { env } from "./env.js";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const defaultCertificatePath = path.resolve(process.cwd(), "prisma", "ca-certificate.crt");

const resolveDatasourceUrl = () => {
  const connectionUrl = new URL(env.DATABASE_URL);
  const isMysql = connectionUrl.protocol === "mysql:";
  const hasTlsConfig =
    connectionUrl.searchParams.has("sslaccept") ||
    connectionUrl.searchParams.has("sslcert") ||
    connectionUrl.searchParams.has("sslidentity") ||
    connectionUrl.searchParams.has("sslpassword");

  if (!isMysql || hasTlsConfig) {
    return env.DATABASE_URL;
  }

  const certificatePath = env.DATABASE_SSL_CERT_PATH ?? defaultCertificatePath;

  if (!existsSync(certificatePath)) {
    return env.DATABASE_URL;
  }

  // Normalize provider-specific SSL flags into Prisma's supported MySQL parameters.
  connectionUrl.searchParams.delete("ssl-mode");
  connectionUrl.searchParams.delete("sslmode");
  connectionUrl.searchParams.set(
    "sslaccept",
    env.DATABASE_SSL_ACCEPT ?? "strict"
  );
  connectionUrl.searchParams.set("sslcert", certificatePath);

  return connectionUrl.toString();
};

export const prisma =
  global.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatasourceUrl()
      }
    },
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
