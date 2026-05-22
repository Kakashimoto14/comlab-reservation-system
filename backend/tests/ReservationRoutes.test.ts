import type { NextFunction, Request, Response } from "express";
import express from "express";
import http from "node:http";
import type { Mock } from "vitest";

type TestRole = "ADMIN" | "STUDENT" | "LABORATORY_STAFF";

const { authState, controllerSpies } = vi.hoisted(() => ({
  authState: {
    user: {
      id: 101,
      sessionId: 202,
      email: "student@comlab.test",
      role: "STUDENT" as TestRole
    }
  },
  controllerSpies: {
    list: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    review: vi.fn(),
    complete: vi.fn()
  }
}));

vi.mock("../src/middleware/auth.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.authUser = authState.user;
    next();
  }
}));

vi.mock("../src/controllers/ReservationController.js", () => ({
  ReservationController: controllerSpies
}));

const createApp = async () => {
  const app = express();
  app.use(express.json());
  const { default: reservationRoutes } = await import("../src/routes/reservation.routes.js");
  app.use("/reservations", reservationRoutes);
  return app;
};

const validReservationPayload = {
  scheduleId: 1,
  laboratoryId: 1,
  reservationType: "LAB",
  purpose: "Database laboratory activity",
  startTime: "09:00",
  endTime: "10:00"
};

const requestApp = (
  app: express.Express,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: Record<string, unknown>
) =>
  new Promise<{ body: unknown; status: number; text: string }>((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const payload = body ? JSON.stringify(body) : undefined;

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to start test server."));
        return;
      }

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method,
          headers: payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
              }
            : undefined
        },
        (res) => {
          const chunks: Buffer[] = [];

          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            server.close((closeError) => {
              let parsedBody: unknown = {};

              if (closeError) {
                reject(closeError);
                return;
              }

              try {
                parsedBody = text ? JSON.parse(text) : {};
              } catch {
                parsedBody = {};
              }

              resolve({
                status: res.statusCode ?? 0,
                text,
                body: parsedBody
              });
            });
          });
        }
      );

      req.on("error", (error) => {
        server.close();
        reject(error);
      });

      if (payload) {
        req.write(payload);
      }

      req.end();
    });
  });

describe("reservation route permissions", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = {
      id: 101,
      sessionId: 202,
      email: "student@comlab.test",
      role: "STUDENT"
    };

    (controllerSpies.create as Mock).mockImplementation((_req: Request, res: Response) =>
      res.status(201).json({ id: 1, status: "PENDING" })
    );
    (controllerSpies.review as Mock).mockImplementation((_req: Request, res: Response) =>
      res.json({ id: 1, status: "APPROVED" })
    );
  });

  it("allows students to submit reservation requests as pending", async () => {
    const response = await requestApp(app, "POST", "/reservations", validReservationPayload);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 1, status: "PENDING" });
    expect(controllerSpies.create).toHaveBeenCalledTimes(1);
    expect(controllerSpies.review).not.toHaveBeenCalled();
  });

  it("blocks students from approving or rejecting reservations", async () => {
    const response = await requestApp(app, "PATCH", "/reservations/1/review", {
      status: "APPROVED",
      remarks: "Approved by staff."
    });

    expect(response.status).toBe(403);
    expect(controllerSpies.review).not.toHaveBeenCalled();
  });

  it("allows laboratory staff to review reservations", async () => {
    authState.user = {
      id: 303,
      sessionId: 404,
      email: "staff@comlab.test",
      role: "LABORATORY_STAFF"
    };

    const response = await requestApp(app, "PATCH", "/reservations/1/review", {
      status: "APPROVED",
      remarks: "Approved by staff."
    });

    expect(response.status).toBe(200);
    expect(controllerSpies.review).toHaveBeenCalledTimes(1);
  });

  it("does not allow admin or laboratory staff to use the student reservation creation route", async () => {
    for (const role of ["ADMIN", "LABORATORY_STAFF"] as const) {
      authState.user = {
        id: 505,
        sessionId: 606,
        email: `${role.toLowerCase()}@comlab.test`,
        role
      };

      const response = await requestApp(app, "POST", "/reservations", validReservationPayload);

      expect(response.status).toBe(403);
    }

    expect(controllerSpies.create).not.toHaveBeenCalled();
  });
});
