import { AppointmentStatus, PaymentMethod, PaymentStatus, PrismaClient, StockMovementType, UserRole } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/auth.crypto.js";

const prisma = new PrismaClient();
const adminPasswordHash = hashPassword("admin12345");
const employeePasswordHash = hashPassword("employee12345");

async function main() {
  const serviceCategories = await Promise.all([
    upsertServiceCategory(1n, "Haircuts", "Women and men haircuts"),
    upsertServiceCategory(2n, "Manicure", "Nail care and polish"),
    upsertServiceCategory(3n, "Coloring", "Coloring, toning, and color change"),
    upsertServiceCategory(4n, "Trichology", "Scalp diagnostics and care")
  ]);

  const haircut = await prisma.service.upsert({
    where: { id: 1n },
    update: {
      name: "Women's haircut",
      description: "Consultation, wash, haircut, and styling."
    },
    create: {
      name: "Women's haircut",
      description: "Consultation, wash, haircut, and styling.",
      durationMinutes: 60,
      price: "120.00"
    }
  });

  const manicure = await prisma.service.upsert({
    where: { id: 2n },
    update: {
      name: "Classic manicure",
      description: "Nail shaping, cuticle care, and polish."
    },
    create: {
      name: "Classic manicure",
      description: "Nail shaping, cuticle care, and polish.",
      durationMinutes: 45,
      price: "80.00"
    }
  });

  const coloring = await prisma.service.upsert({
    where: { id: 3n },
    update: {
      name: "Hair coloring",
      description: "Color consultation and full color service."
    },
    create: {
      name: "Hair coloring",
      description: "Color consultation and full color service.",
      durationMinutes: 120,
      price: "260.00"
    }
  });

  await Promise.all([
    assignServiceCategory(haircut.id, serviceCategories[0].id),
    assignServiceCategory(manicure.id, serviceCategories[1].id),
    assignServiceCategory(coloring.id, serviceCategories[2].id)
  ]);

  await translateLegacyDemoServices();

  await prisma.user.upsert({
    where: { email: "admin@sl-color.local" },
    update: {
      firstName: "Main",
      lastName: "Admin",
      phone: "+380500000000",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN
    },
    create: {
      firstName: "Main",
      lastName: "Admin",
      phone: "+380500000000",
      email: "admin@sl-color.local",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN
    }
  });

  const annaUser = await prisma.user.upsert({
    where: { email: "anna@soulbeauty.local" },
    update: {
      passwordHash: employeePasswordHash,
      role: UserRole.EMPLOYEE
    },
    create: {
      firstName: "Anna",
      lastName: "Kowalska",
      phone: "+48111000111",
      email: "anna@soulbeauty.local",
      passwordHash: employeePasswordHash,
      role: UserRole.EMPLOYEE
    }
  });

  const mayaUser = await prisma.user.upsert({
    where: { email: "maya@soulbeauty.local" },
    update: {
      passwordHash: employeePasswordHash,
      role: UserRole.EMPLOYEE
    },
    create: {
      firstName: "Maya",
      lastName: "Nowak",
      phone: "+48111000222",
      email: "maya@soulbeauty.local",
      passwordHash: employeePasswordHash,
      role: UserRole.EMPLOYEE
    }
  });

  const anna = await prisma.employee.upsert({
    where: { userId: annaUser.id },
    update: {
      specialization: "hair stylist and colorist",
      description: "Haircuts, styling, and color transformations."
    },
    create: {
      userId: annaUser.id,
      specialization: "hair stylist and colorist",
      description: "Haircuts, styling, and color transformations."
    }
  });

  const maya = await prisma.employee.upsert({
    where: { userId: mayaUser.id },
    update: {
      specialization: "manicure specialist",
      description: "Manicure, gel polish, and nail care."
    },
    create: {
      userId: mayaUser.id,
      specialization: "manicure specialist",
      description: "Manicure, gel polish, and nail care."
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

  const clients = await Promise.all([
    prisma.user.upsert({
      where: { email: "anna.koval@example.com" },
      update: {},
      create: {
        firstName: "Anna",
        lastName: "Koval",
        phone: "+48501221003",
        email: "anna.koval@example.com"
      }
    }),
    prisma.user.upsert({
      where: { email: "olena.marchuk@example.com" },
      update: {},
      create: {
        firstName: "Olena",
        lastName: "Marchuk",
        phone: "+48509771420",
        email: "olena.marchuk@example.com"
      }
    }),
    prisma.user.upsert({
      where: { email: "iryna.savchuk@example.com" },
      update: {},
      create: {
        firstName: "Iryna",
        lastName: "Savchuk",
        phone: "+48600118905",
        email: "iryna.savchuk@example.com"
      }
    })
  ]);

  const today = new Date();
  const atToday = (hours: number, minutes: number) => {
    const date = new Date(today);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const appointmentData = [
    {
      id: 1n,
      clientId: clients[1].id,
      employeeId: anna.id,
      serviceIds: [haircut.id],
      startTime: atToday(10, 0),
      endTime: atToday(11, 0),
      status: AppointmentStatus.PENDING,
      comment: "Requests light styling"
    },
    {
      id: 2n,
      clientId: clients[2].id,
      employeeId: maya.id,
      serviceIds: [manicure.id],
      startTime: atToday(12, 15),
      endTime: atToday(13, 0),
      status: AppointmentStatus.COMPLETED,
      comment: "Classic manicure"
    },
    {
      id: 3n,
      clientId: clients[0].id,
      employeeId: anna.id,
      serviceIds: [coloring.id],
      startTime: atToday(14, 30),
      endTime: atToday(16, 30),
      status: AppointmentStatus.PENDING,
      comment: "Coloring, cool shade"
    }
  ];

  for (const appointment of appointmentData) {
    await prisma.appointment.upsert({
      where: { id: appointment.id },
      update: {
        clientId: appointment.clientId,
        employeeId: appointment.employeeId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        clientComment: appointment.comment
      },
      create: {
        id: appointment.id,
        clientId: appointment.clientId,
        employeeId: appointment.employeeId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        clientComment: appointment.comment
      }
    });

    await prisma.appointmentService.deleteMany({
      where: {
        appointmentId: appointment.id,
        serviceId: { notIn: appointment.serviceIds }
      }
    });

    for (const serviceId of appointment.serviceIds) {
      await prisma.appointmentService.upsert({
        where: { appointmentId_serviceId: { appointmentId: appointment.id, serviceId } },
        update: {},
        create: { appointmentId: appointment.id, serviceId }
      });
    }
  }

  await prisma.payment.upsert({
    where: { appointmentId: 2n },
    update: { amount: "80.00", paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.PAID, paidAt: atToday(13, 5) },
    create: {
      appointmentId: 2n,
      amount: "80.00",
      paymentMethod: PaymentMethod.CARD,
      paymentStatus: PaymentStatus.PAID,
      paidAt: atToday(13, 5)
    }
  });

  await prisma.payment.upsert({
    where: { appointmentId: 3n },
    update: { amount: "260.00", paymentMethod: PaymentMethod.BLIK, paymentStatus: PaymentStatus.PENDING },
    create: {
      appointmentId: 3n,
      amount: "260.00",
      paymentMethod: PaymentMethod.BLIK,
      paymentStatus: PaymentStatus.PENDING
    }
  });

  const categories = await Promise.all([
    prisma.productCategory.upsert({
      where: { id: 1n },
      update: { name: "Shampoos", description: "Home care" },
      create: { id: 1n, name: "Shampoos", description: "Home care" }
    }),
    prisma.productCategory.upsert({
      where: { id: 2n },
      update: { name: "Masks", description: "Hair restoration" },
      create: { id: 2n, name: "Masks", description: "Hair restoration" }
    }),
    prisma.productCategory.upsert({
      where: { id: 3n },
      update: { name: "Styling", description: "Finishing products" },
      create: { id: 3n, name: "Styling", description: "Finishing products" }
    })
  ]);

  const shampoo = await prisma.product.upsert({
    where: { sku: "SL-SH-001" },
    update: { stockQuantity: 2, minStockQuantity: 4 },
    create: {
      categoryId: categories[0].id,
      name: "Color Care Shampoo",
      brand: "SL",
      sku: "SL-SH-001",
      purchasePrice: "42.00",
      sellingPrice: "75.00",
      stockQuantity: 2,
      minStockQuantity: 4
    }
  });

  const mask = await prisma.product.upsert({
    where: { sku: "SL-MASK-001" },
    update: { stockQuantity: 7, minStockQuantity: 3 },
    create: {
      categoryId: categories[1].id,
      name: "Repair Mask",
      brand: "SL",
      sku: "SL-MASK-001",
      purchasePrice: "58.00",
      sellingPrice: "110.00",
      stockQuantity: 7,
      minStockQuantity: 3
    }
  });

  const spray = await prisma.product.upsert({
    where: { sku: "SL-SPRAY-001" },
    update: { stockQuantity: 1, minStockQuantity: 5 },
    create: {
      categoryId: categories[2].id,
      name: "Thermo Spray",
      brand: "SL",
      sku: "SL-SPRAY-001",
      purchasePrice: "36.00",
      sellingPrice: "70.00",
      stockQuantity: 1,
      minStockQuantity: 5
    }
  });

  const sale = await prisma.productSale.upsert({
    where: { id: 1n },
    update: {
      clientId: clients[0].id,
      employeeId: anna.id,
      totalAmount: "110.00",
      saleDate: atToday(13, 20)
    },
    create: {
      id: 1n,
      clientId: clients[0].id,
      employeeId: anna.id,
      totalAmount: "110.00",
      saleDate: atToday(13, 20)
    }
  });

  await prisma.productSaleItem.upsert({
    where: { saleId_productId: { saleId: sale.id, productId: mask.id } },
    update: { quantity: 1, unitPrice: "110.00" },
    create: { saleId: sale.id, productId: mask.id, quantity: 1, unitPrice: "110.00" }
  });

  await prisma.payment.upsert({
    where: { productSaleId: sale.id },
    update: { amount: "110.00", paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PAID, paidAt: atToday(13, 25) },
    create: {
      productSaleId: sale.id,
      amount: "110.00",
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      paidAt: atToday(13, 25)
    }
  });

  for (const movement of [
    { id: 1n, productId: shampoo.id, movementType: StockMovementType.SALE, quantity: -2, reason: "Client sale" },
    { id: 2n, productId: mask.id, movementType: StockMovementType.PURCHASE, quantity: 6, reason: "Stock replenishment" },
    { id: 3n, productId: spray.id, movementType: StockMovementType.ADJUSTMENT, quantity: -1, reason: "Stock adjustment" }
  ]) {
    await prisma.stockMovement.upsert({
      where: { id: movement.id },
      update: movement,
      create: movement
    });
  }

  await prisma.portfolioPhoto.upsert({
    where: { id: 1n },
    update: { description: "Cool blonde", isVisible: true },
    create: {
      id: 1n,
      employeeId: anna.id,
      imageUrl: "/uploads/portfolio/cold-blonde.jpg",
      description: "Cool blonde",
      isVisible: true
    }
  });

  await prisma.portfolioPhoto.upsert({
    where: { id: 2n },
    update: { description: "Length restoration", isVisible: true },
    create: {
      id: 2n,
      employeeId: anna.id,
      imageUrl: "/uploads/portfolio/repair-length.jpg",
      description: "Length restoration",
      isVisible: true
    }
  });

  await prisma.review.upsert({
    where: { appointmentId: 2n },
    update: { rating: 5, comment: "Very neat work, the color holds beautifully." },
    create: {
      appointmentId: 2n,
      rating: 5,
      comment: "Very neat work, the color holds beautifully."
    }
  });

  await prisma.employeeTimeOff.upsert({
    where: { id: 1n },
    update: { employeeId: anna.id, startTime: atToday(22, 0), endTime: atToday(23, 0), reason: "Day off" },
    create: { id: 1n, employeeId: anna.id, startTime: atToday(22, 0), endTime: atToday(23, 0), reason: "Day off" }
  });

  await prisma.salonSetting.upsert({
    where: { id: 1n },
    update: {
      salonName: "SL Color Studio",
      phone: "+38 (050) 23 03 408",
      email: "sl.color.studio@example.com",
      address: "Brody, Stusa St. 2",
      openingTime: "09:00",
      closingTime: "18:00"
    },
    create: {
      id: 1n,
      salonName: "SL Color Studio",
      phone: "+38 (050) 23 03 408",
      email: "sl.color.studio@example.com",
      address: "Brody, Stusa St. 2",
      openingTime: "09:00",
      closingTime: "18:00"
    }
  });

  for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
    await prisma.businessHour.upsert({
      where: { dayOfWeek },
      update: { openTime: "09:00", closeTime: "18:00", isClosed: false },
      create: { dayOfWeek, openTime: "09:00", closeTime: "18:00", isClosed: false }
    });
  }

  for (const table of [
    "service_categories",
    "services",
    "appointments",
    "product_categories",
    "product_sales",
    "stock_movements",
    "portfolio_photos",
    "employee_time_off",
    "salon_settings"
  ]) {
    await resetSequence(table);
  }
}

async function resetSequence(table: string) {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`
  );
}

async function upsertServiceCategory(id: bigint, name: string, description: string) {
  const [category] = await prisma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO service_categories (id, name, description, is_active, updated_at)
    VALUES (${id}, ${name}, ${description}, true, now())
    ON CONFLICT (id)
    DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true, updated_at = now()
    RETURNING id
  `;

  return category;
}

async function assignServiceCategory(serviceId: bigint, categoryId: bigint) {
  await prisma.$executeRaw`
    UPDATE services
    SET category_id = ${categoryId}
    WHERE id = ${serviceId}
  `;
}

async function translateLegacyDemoServices() {
  const legacyPeelingName = "\u041f\u0456\u043b\u0456\u043d\u0433";
  const legacyHaircutName = "\u0421\u0442\u0440\u0438\u0436\u043a\u0430";

  await prisma.$executeRaw`
    UPDATE services
    SET name = 'Scalp peeling', description = 'Scalp peeling treatment.'
    WHERE name = ${legacyPeelingName}
  `;

  await prisma.$executeRaw`
    UPDATE services
    SET name = 'Haircut', description = 'Short haircut service.'
    WHERE name = ${legacyHaircutName}
  `;
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
