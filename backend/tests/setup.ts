process.env.PORT = "5000";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "mysql://root:password@localhost:3306/comlab_reservation_system_test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret-key";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1d";
process.env.CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
