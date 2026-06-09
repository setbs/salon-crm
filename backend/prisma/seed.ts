import { AppointmentStatus, PaymentMethod, PaymentStatus, PrismaClient, StockMovementType, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const serviceCategories = await Promise.all([
    upsertServiceCategory(1n, "Стрижки", "Жіночі та чоловічі стрижки"),
    upsertServiceCategory(2n, "Манікюр", "Догляд за нігтями та покриття"),
    upsertServiceCategory(3n, "Фарбування", "Колористика, тонування та зміна кольору"),
    upsertServiceCategory(4n, "Трихологія", "Діагностика та догляд за шкірою голови")
  ]);

  const haircut = await prisma.service.upsert({
    where: { id: 1n },
    update: {
      name: "Жіноча стрижка",
      description: "Консультація, миття, стрижка та укладка."
    },
    create: {
      name: "Жіноча стрижка",
      description: "Консультація, миття, стрижка та укладка.",
      durationMinutes: 60,
      price: "120.00"
    }
  });

  const manicure = await prisma.service.upsert({
    where: { id: 2n },
    update: {
      name: "Класичний манікюр",
      description: "Форма, кутикула та покриття."
    },
    create: {
      name: "Класичний манікюр",
      description: "Форма, кутикула та покриття.",
      durationMinutes: 45,
      price: "80.00"
    }
  });

  const coloring = await prisma.service.upsert({
    where: { id: 3n },
    update: {
      name: "Фарбування волосся",
      description: "Консультація з кольору та повне фарбування."
    },
    create: {
      name: "Фарбування волосся",
      description: "Консультація з кольору та повне фарбування.",
      durationMinutes: 120,
      price: "260.00"
    }
  });

  await Promise.all([
    assignServiceCategory(haircut.id, serviceCategories[0].id),
    assignServiceCategory(manicure.id, serviceCategories[1].id),
    assignServiceCategory(coloring.id, serviceCategories[2].id)
  ]);

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
    update: {
      specialization: "перукар-колорист",
      description: "Стрижки, укладки та зміна кольору."
    },
    create: {
      userId: annaUser.id,
      specialization: "перукар-колорист",
      description: "Стрижки, укладки та зміна кольору."
    }
  });

  const maya = await prisma.employee.upsert({
    where: { userId: mayaUser.id },
    update: {
      specialization: "майстер манікюру",
      description: "Манікюр, гель-лак та догляд за нігтями."
    },
    create: {
      userId: mayaUser.id,
      specialization: "майстер манікюру",
      description: "Манікюр, гель-лак та догляд за нігтями."
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
        firstName: "Анна",
        lastName: "Коваль",
        phone: "+48501221003",
        email: "anna.koval@example.com"
      }
    }),
    prisma.user.upsert({
      where: { email: "olena.marchuk@example.com" },
      update: {},
      create: {
        firstName: "Олена",
        lastName: "Марчук",
        phone: "+48509771420",
        email: "olena.marchuk@example.com"
      }
    }),
    prisma.user.upsert({
      where: { email: "iryna.savchuk@example.com" },
      update: {},
      create: {
        firstName: "Ірина",
        lastName: "Савчук",
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
      comment: "Просить легку укладку"
    },
    {
      id: 2n,
      clientId: clients[2].id,
      employeeId: maya.id,
      serviceIds: [manicure.id],
      startTime: atToday(12, 15),
      endTime: atToday(13, 0),
      status: AppointmentStatus.COMPLETED,
      comment: "Класичний манікюр"
    },
    {
      id: 3n,
      clientId: clients[0].id,
      employeeId: anna.id,
      serviceIds: [coloring.id],
      startTime: atToday(14, 30),
      endTime: atToday(16, 30),
      status: AppointmentStatus.PENDING,
      comment: "Фарбування, холодний відтінок"
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
      update: { name: "Шампуні", description: "Домашній догляд" },
      create: { id: 1n, name: "Шампуні", description: "Домашній догляд" }
    }),
    prisma.productCategory.upsert({
      where: { id: 2n },
      update: { name: "Маски", description: "Відновлення волосся" },
      create: { id: 2n, name: "Маски", description: "Відновлення волосся" }
    }),
    prisma.productCategory.upsert({
      where: { id: 3n },
      update: { name: "Стайлінг", description: "Фінішні засоби" },
      create: { id: 3n, name: "Стайлінг", description: "Фінішні засоби" }
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
    { id: 1n, productId: shampoo.id, movementType: StockMovementType.SALE, quantity: -2, reason: "Продаж клієнту" },
    { id: 2n, productId: mask.id, movementType: StockMovementType.PURCHASE, quantity: 6, reason: "Поповнення складу" },
    { id: 3n, productId: spray.id, movementType: StockMovementType.ADJUSTMENT, quantity: -1, reason: "Коригування залишку" }
  ]) {
    await prisma.stockMovement.upsert({
      where: { id: movement.id },
      update: movement,
      create: movement
    });
  }

  await prisma.portfolioPhoto.upsert({
    where: { id: 1n },
    update: { description: "Холодний блонд", isVisible: true },
    create: {
      id: 1n,
      employeeId: anna.id,
      imageUrl: "/uploads/portfolio/cold-blonde.jpg",
      description: "Холодний блонд",
      isVisible: true
    }
  });

  await prisma.portfolioPhoto.upsert({
    where: { id: 2n },
    update: { description: "Відновлення довжини", isVisible: true },
    create: {
      id: 2n,
      employeeId: anna.id,
      imageUrl: "/uploads/portfolio/repair-length.jpg",
      description: "Відновлення довжини",
      isVisible: true
    }
  });

  await prisma.review.upsert({
    where: { appointmentId: 2n },
    update: { rating: 5, comment: "Дуже акуратна робота, колір тримається чудово." },
    create: {
      appointmentId: 2n,
      rating: 5,
      comment: "Дуже акуратна робота, колір тримається чудово."
    }
  });

  await prisma.employeeTimeOff.upsert({
    where: { id: 1n },
    update: { employeeId: anna.id, startTime: atToday(22, 0), endTime: atToday(23, 0), reason: "Вихідний" },
    create: { id: 1n, employeeId: anna.id, startTime: atToday(22, 0), endTime: atToday(23, 0), reason: "Вихідний" }
  });

  await prisma.salonSetting.upsert({
    where: { id: 1n },
    update: {
      salonName: "SL Color Studio",
      phone: "+38 (050) 23 03 408",
      email: "sl.color.studio@example.com",
      address: "м. Броди, вул. Стуса 2",
      openingTime: "09:00",
      closingTime: "18:00"
    },
    create: {
      id: 1n,
      salonName: "SL Color Studio",
      phone: "+38 (050) 23 03 408",
      email: "sl.color.studio@example.com",
      address: "м. Броди, вул. Стуса 2",
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
