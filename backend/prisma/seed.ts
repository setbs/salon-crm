import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const haircut = await prisma.service.upsert({
    where: { id: 1n },
    update: {},
    create: {
      name: "Women's haircut",
      description: "Consultation, wash, haircut and styling.",
      durationMinutes: 60,
      price: "120.00"
    }
  });

  const manicure = await prisma.service.upsert({
    where: { id: 2n },
    update: {},
    create: {
      name: "Classic manicure",
      description: "Nail shaping, cuticle care and polish.",
      durationMinutes: 45,
      price: "80.00"
    }
  });

  const coloring = await prisma.service.upsert({
    where: { id: 3n },
    update: {},
    create: {
      name: "Hair coloring",
      description: "Color consultation and full color service.",
      durationMinutes: 120,
      price: "260.00"
    }
  });

  const annaUser = await prisma.user.upsert({
    where: { email: "anna@soulbeauty.local" },
    update: {},
    create: {
      firstName: "Anna",
      lastName: "Kowalska",
      phone: "+48111000111",
      email: "anna@soulbeauty.local",
      role: UserRole.EMPLOYEE
    }
  });

  const mayaUser = await prisma.user.upsert({
    where: { email: "maya@soulbeauty.local" },
    update: {},
    create: {
      firstName: "Maya",
      lastName: "Nowak",
      phone: "+48111000222",
      email: "maya@soulbeauty.local",
      role: UserRole.EMPLOYEE
    }
  });

  const anna = await prisma.employee.upsert({
    where: { userId: annaUser.id },
    update: {},
    create: {
      userId: annaUser.id,
      specialization: "Hair stylist",
      description: "Cuts, styling and color transformations."
    }
  });

  const maya = await prisma.employee.upsert({
    where: { userId: mayaUser.id },
    update: {},
    create: {
      userId: mayaUser.id,
      specialization: "Nail artist",
      description: "Manicure, gel polish and nail care."
    }
  });

  for (const service of [haircut, coloring]) {
    await prisma.employeeService.upsert({
      where: { employeeId_serviceId: { employeeId: anna.id, serviceId: service.id } },
      update: {},
      create: { employeeId: anna.id, serviceId: service.id }
    });
  }

  await prisma.employeeService.upsert({
    where: { employeeId_serviceId: { employeeId: maya.id, serviceId: manicure.id } },
    update: {},
    create: { employeeId: maya.id, serviceId: manicure.id }
  });

  for (const employee of [anna, maya]) {
    for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
      await prisma.workingHour.upsert({
        where: { employeeId_dayOfWeek: { employeeId: employee.id, dayOfWeek } },
        update: {},
        create: {
          employeeId: employee.id,
          dayOfWeek,
          startTime: "09:00",
          endTime: "18:00"
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
