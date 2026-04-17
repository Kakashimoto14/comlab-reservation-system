import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dayjs from "dayjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.laboratory.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.create({
    data: {
      firstName: "Marianne",
      lastName: "Torres",
      email: "admin@comlab.edu",
      passwordHash,
      role: "ADMIN",
      department: "College of Information Technology",
      phone: "09171234567"
    }
  });

  const staff = await prisma.user.create({
    data: {
      firstName: "Daniel",
      lastName: "Reyes",
      email: "staff@comlab.edu",
      passwordHash,
      role: "LABORATORY_STAFF",
      department: "Computer Laboratory Office",
      phone: "09179876543"
    }
  });

  const studentSeeds = [
    ["Alyssa", "Cruz", "2024-0001", 2],
    ["Brian", "Santos", "2024-0002", 2],
    ["Carla", "Dizon", "2024-0003", 2],
    ["Derrick", "Lim", "2024-0004", 3],
    ["Elaine", "Navarro", "2024-0005", 1]
  ] as const;

  const students = await Promise.all(
    studentSeeds.map(([firstName, lastName, studentNumber, yearLevel], index) =>
      prisma.user.create({
        data: {
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.edu`,
          passwordHash,
          role: "STUDENT",
          studentNumber,
          department: "BS Information Technology",
          yearLevel,
          phone: `0917000000${index + 1}`
        }
      })
    )
  );

  const laboratories = await Promise.all([
    prisma.laboratory.create({
      data: {
        name: "Systems Development Laboratory",
        roomCode: "CL-301",
        building: "ICT Building",
        capacity: 40,
        computerCount: 36,
        description: "A modern laboratory for programming, database, and software engineering classes.",
        status: "AVAILABLE",
        imageUrl:
          "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80"
      }
    }),
    prisma.laboratory.create({
      data: {
        name: "Networking and Hardware Laboratory",
        roomCode: "CL-302",
        building: "ICT Building",
        capacity: 32,
        computerCount: 30,
        description: "Configured for networking, hardware assembly, and infrastructure activities.",
        status: "AVAILABLE",
        imageUrl:
          "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80"
      }
    }),
    prisma.laboratory.create({
      data: {
        name: "Multimedia Authoring Laboratory",
        roomCode: "CL-303",
        building: "Innovation Center",
        capacity: 28,
        computerCount: 25,
        description: "Designed for UI/UX, multimedia editing, and capstone presentations.",
        status: "AVAILABLE",
        imageUrl:
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80"
      }
    })
  ]);

  const today = dayjs().startOf("day");
  const scheduleSeeds = [
    { lab: laboratories[2], dayOffset: -2, startTime: "08:00", endTime: "11:00" },
    { lab: laboratories[0], dayOffset: 1, startTime: "08:00", endTime: "17:00" },
    { lab: laboratories[1], dayOffset: 2, startTime: "09:00", endTime: "16:00" },
    { lab: laboratories[2], dayOffset: 3, startTime: "08:00", endTime: "16:00" }
  ];

  const schedules = await Promise.all(
    scheduleSeeds.map((seed, index) =>
      prisma.schedule.create({
        data: {
          laboratoryId: seed.lab.id,
          date: today.add(seed.dayOffset, "day").toDate(),
          startTime: seed.startTime,
          endTime: seed.endTime,
          status: "AVAILABLE",
          createdById: index % 2 === 0 ? admin.id : staff.id
        }
      })
    )
  );

  const reservations = await Promise.all([
    prisma.reservation.create({
      data: {
        reservationCode: "RSV-2026-0001",
        studentId: students[0].id,
        laboratoryId: laboratories[0].id,
        scheduleId: schedules[1].id,
        purpose: "Database laboratory exercise for our BSIT 2A section.",
        reservationDate: today.add(1, "day").toDate(),
        startTime: "08:30",
        endTime: "10:30",
        status: "PENDING"
      }
    }),
    prisma.reservation.create({
      data: {
        reservationCode: "RSV-2026-0002",
        studentId: students[1].id,
        laboratoryId: laboratories[1].id,
        scheduleId: schedules[2].id,
        purpose: "Networking simulation and router configuration activity.",
        reservationDate: today.add(2, "day").toDate(),
        startTime: "09:30",
        endTime: "11:30",
        status: "APPROVED",
        reviewedById: staff.id,
        reviewedAt: today.toDate(),
        remarks: "Approved for scheduled laboratory exercise."
      }
    }),
    prisma.reservation.create({
      data: {
        reservationCode: "RSV-2026-0003",
        studentId: students[2].id,
        laboratoryId: laboratories[2].id,
        scheduleId: schedules[0].id,
        purpose: "Capstone prototype demonstration and usability walkthrough.",
        reservationDate: today.subtract(2, "day").toDate(),
        startTime: "08:30",
        endTime: "10:00",
        status: "COMPLETED",
        reviewedById: admin.id,
        reviewedAt: today.subtract(2, "day").toDate(),
        remarks: "Session completed successfully."
      }
    }),
    prisma.reservation.create({
      data: {
        reservationCode: "RSV-2026-0004",
        studentId: students[3].id,
        laboratoryId: laboratories[0].id,
        scheduleId: schedules[1].id,
        purpose: "Frontend development consultation and system demo preparation.",
        reservationDate: today.add(1, "day").toDate(),
        startTime: "13:30",
        endTime: "15:00",
        status: "REJECTED",
        reviewedById: admin.id,
        reviewedAt: today.toDate(),
        remarks: "Laboratory reserved for departmental faculty training."
      }
    }),
    prisma.reservation.create({
      data: {
        reservationCode: "RSV-2026-0005",
        studentId: students[4].id,
        laboratoryId: laboratories[2].id,
        scheduleId: schedules[3].id,
        purpose: "Multimedia editing practice for the digital content module.",
        reservationDate: today.add(3, "day").toDate(),
        startTime: "13:00",
        endTime: "14:30",
        status: "CANCELLED",
        cancelledAt: today.toDate(),
        remarks: "Cancelled by student due to class conflict."
      }
    })
  ]);

  await prisma.activityLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "CREATE_LABORATORY",
        entityType: "LABORATORY",
        entityId: laboratories[0].id,
        description: "Created Systems Development Laboratory."
      },
      {
        userId: staff.id,
        action: "CREATE_SCHEDULE",
        entityType: "SCHEDULE",
        entityId: schedules[2].id,
        description: "Published Networking Laboratory morning schedule."
      },
      {
        userId: students[0].id,
        action: "CREATE_RESERVATION",
        entityType: "RESERVATION",
        entityId: reservations[0].id,
        description: "Submitted a pending reservation for CL-301."
      },
      {
        userId: staff.id,
        action: "APPROVE_RESERVATION",
        entityType: "RESERVATION",
        entityId: reservations[1].id,
        description: "Approved a laboratory reservation request."
      }
    ]
  });

  console.log("Seed data created successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
