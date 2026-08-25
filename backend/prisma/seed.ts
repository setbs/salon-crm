import { AppointmentStatus, ConsumableUnit, PaymentMethod, PaymentStatus, PrismaClient, StockMovementType, UserRole } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/auth.crypto.js";

const prisma = new PrismaClient();
const adminPasswordHash = hashPassword("admin12345");
const employeePasswordHash = hashPassword("employee12345");

async function main() {
  const serviceCategories = await Promise.all([
    upsertServiceCategory(1n, "Haircuts", "Women and men haircuts"),
    upsertServiceCategory(2n, "Manicure", "Nail care and polish"),
    upsertServiceCategory(3n, "Coloring", "Coloring, toning, and color change"),
    upsertServiceCategory(4n, "Trichology", "Scalp diagnostics and care"),
    upsertServiceCategory(5n, "Restoration", "Hair restoration and reconstruction")
  ]);

  const haircut = await prisma.service.upsert({
    where: { id: 1n },
    update: {
      name: "Women's haircut",
      description: "Consultation, wash, haircut, and styling.",
      durationMinutes: 60,
      price: "650.00",
      priceFrom: "500.00",
      priceTo: "800.00"
    },
    create: {
      id: 1n,
      name: "Women's haircut",
      description: "Consultation, wash, haircut, and styling.",
      durationMinutes: 60,
      price: "650.00",
      priceFrom: "500.00",
      priceTo: "800.00"
    }
  });

  const manicure = await prisma.service.upsert({
    where: { id: 2n },
    update: {
      name: "Classic manicure",
      description: "Nail shaping, cuticle care, and polish.",
      durationMinutes: 45,
      price: "500.00",
      priceFrom: "400.00",
      priceTo: "600.00"
    },
    create: {
      id: 2n,
      name: "Classic manicure",
      description: "Nail shaping, cuticle care, and polish.",
      durationMinutes: 45,
      price: "500.00",
      priceFrom: "400.00",
      priceTo: "600.00"
    }
  });

  const coloring = await prisma.service.upsert({
    where: { id: 3n },
    update: {
      name: "Hair coloring",
      description: "Color consultation and full color service.",
      durationMinutes: 150,
      price: "3000.00",
      priceFrom: "1800.00",
      priceTo: "4500.00"
    },
    create: {
      id: 3n,
      name: "Hair coloring",
      description: "Color consultation and full color service.",
      durationMinutes: 150,
      price: "3000.00",
      priceFrom: "1800.00",
      priceTo: "4500.00"
    }
  });

  const scalpPeeling = await prisma.service.upsert({
    where: { id: 4n },
    update: {
      name: "Scalp peeling",
      description: "Scalp cleansing and care with professional cosmetics.",
      durationMinutes: 60,
      price: "1500.00",
      priceFrom: "1200.00",
      priceTo: "1800.00"
    },
    create: {
      id: 4n,
      name: "Scalp peeling",
      description: "Scalp cleansing and care with professional cosmetics.",
      durationMinutes: 60,
      price: "1500.00",
      priceFrom: "1200.00",
      priceTo: "1800.00"
    }
  });

  const reconstruction = await prisma.service.upsert({
    where: { id: 5n },
    update: {
      name: "Deep reconstruction",
      description: "Intensive restoration treatment for damaged length.",
      durationMinutes: 90,
      price: "2200.00",
      priceFrom: "1800.00",
      priceTo: "3400.00"
    },
    create: {
      id: 5n,
      name: "Deep reconstruction",
      description: "Intensive restoration treatment for damaged length.",
      durationMinutes: 90,
      price: "2200.00",
      priceFrom: "1800.00",
      priceTo: "3400.00"
    }
  });

  await Promise.all([
    assignServiceCategory(haircut.id, serviceCategories[0].id),
    assignServiceCategory(manicure.id, serviceCategories[1].id),
    assignServiceCategory(coloring.id, serviceCategories[2].id),
    assignServiceCategory(scalpPeeling.id, serviceCategories[3].id),
    assignServiceCategory(reconstruction.id, serviceCategories[4].id)
  ]);

  await translateLegacyDemoServices();

  await prisma.user.upsert({
    where: { email: "admin@sl-color.local" },
    update: {
      firstName: "Main",
      lastName: "Admin",
      phone: "+38050 23 03 408",
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





  for (const service of [haircut, coloring, scalpPeeling, reconstruction]) {
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
  const atDayOffset = (dayOffset: number, hours: number, minutes: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
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
      endTime: atToday(17, 0),
      status: AppointmentStatus.PENDING,
      comment: "Coloring, cool shade"
    },
    {
      id: 4n,
      clientId: clients[0].id,
      employeeId: anna.id,
      serviceIds: [scalpPeeling.id],
      startTime: atDayOffset(-1, 11, 0),
      endTime: atDayOffset(-1, 12, 0),
      status: AppointmentStatus.COMPLETED,
      comment: "Sensitive scalp, cooling peeling"
    },
    {
      id: 5n,
      clientId: clients[1].id,
      employeeId: anna.id,
      serviceIds: [coloring.id, reconstruction.id],
      startTime: atDayOffset(-3, 13, 0),
      endTime: atDayOffset(-3, 17, 0),
      status: AppointmentStatus.COMPLETED,
      comment: "Color correction with reconstruction"
    },
    {
      id: 6n,
      clientId: clients[2].id,
      employeeId: anna.id,
      serviceIds: [haircut.id, reconstruction.id],
      startTime: atDayOffset(-8, 10, 0),
      endTime: atDayOffset(-8, 12, 30),
      status: AppointmentStatus.COMPLETED,
      comment: "Length refresh and treatment"
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
    update: { amount: "500.00", paymentMethod: PaymentMethod.CARD, paymentStatus: PaymentStatus.PAID, paidAt: atToday(13, 5) },
    create: {
      appointmentId: 2n,
      amount: "500.00",
      paymentMethod: PaymentMethod.CARD,
      paymentStatus: PaymentStatus.PAID,
      paidAt: atToday(13, 5)
    }
  });

  await prisma.payment.upsert({
    where: { appointmentId: 3n },
    update: { amount: "3000.00", paymentMethod: PaymentMethod.BLIK, paymentStatus: PaymentStatus.PENDING },
    create: {
      appointmentId: 3n,
      amount: "3000.00",
      paymentMethod: PaymentMethod.BLIK,
      paymentStatus: PaymentStatus.PENDING
    }
  });

  for (const payment of [
    { appointmentId: 4n, amount: "1500.00", paymentMethod: PaymentMethod.CASH, paidAt: atDayOffset(-1, 12, 5) },
    { appointmentId: 5n, amount: "4800.00", paymentMethod: PaymentMethod.CARD, paidAt: atDayOffset(-3, 17, 10) },
    { appointmentId: 6n, amount: "2700.00", paymentMethod: PaymentMethod.BLIK, paidAt: atDayOffset(-8, 12, 40) }
  ]) {
    await prisma.payment.upsert({
      where: { appointmentId: payment.appointmentId },
      update: {
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentStatus: PaymentStatus.PAID,
        paidAt: payment.paidAt
      },
      create: {
        appointmentId: payment.appointmentId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentStatus: PaymentStatus.PAID,
        paidAt: payment.paidAt
      }
    });
  }

  const categories = await Promise.all([
    prisma.productCategory.upsert({
      where: { id: 1n },
      update: { name: "Hair shampoos", description: "Professional home care", imageUrl: null },
      create: { id: 1n, name: "Hair shampoos", description: "Professional home care", imageUrl: null }
    }),
    prisma.productCategory.upsert({
      where: { id: 2n },
      update: { name: "Hair conditioners", description: "Smoothness and easy combing", imageUrl: null },
      create: { id: 2n, name: "Hair conditioners", description: "Smoothness and easy combing", imageUrl: null }
    }),
    prisma.productCategory.upsert({
      where: { id: 3n },
      update: { name: "Treatment products", description: "Masks, peelings, and reconstruction care", imageUrl: null },
      create: { id: 3n, name: "Treatment products", description: "Masks, peelings, and reconstruction care", imageUrl: null }
    })
  ]);

  const professionalBrand = await prisma.productBrand.upsert({
    where: { name: "Na Golovu" },
    update: { description: "Professional cosmetics used in salon services and retail." },
    create: { name: "Na Golovu", description: "Professional cosmetics used in salon services and retail." }
  });

  const shampoo = await prisma.product.upsert({
    where: { sku: "SL-SH-001" },
    update: {
      categoryId: categories[0].id,
      brandId: professionalBrand.id,
      brand: professionalBrand.name,
      name: "Hyaluronic acid shampoo",
      description: "Professional shampoo for all hair types with hyaluronic acid.",
      quote: "Clean hair is the beginning of a good color story.",
      purchasePrice: "600.00",
      sellingPrice: "950.00",
      stockQuantity: 5,
      minStockQuantity: 3,
      contentAmount: "250.00",
      contentUnit: ConsumableUnit.ML,
      stockContentAmount: "1475.00",
      productPurpose: "BOTH",
      imageUrl: null
    },
    create: {
      categoryId: categories[0].id,
      brandId: professionalBrand.id,
      name: "Hyaluronic acid shampoo",
      brand: professionalBrand.name,
      description: "Professional shampoo for all hair types with hyaluronic acid.",
      quote: "Clean hair is the beginning of a good color story.",
      sku: "SL-SH-001",
      purchasePrice: "600.00",
      sellingPrice: "950.00",
      stockQuantity: 5,
      minStockQuantity: 3,
      contentAmount: "250.00",
      contentUnit: ConsumableUnit.ML,
      stockContentAmount: "1475.00",
      productPurpose: "BOTH",
      imageUrl: null
    }
  });

  const mask = await prisma.product.upsert({
    where: { sku: "SL-MASK-001" },
    update: {
      categoryId: categories[2].id,
      brandId: professionalBrand.id,
      brand: professionalBrand.name,
      name: "Repair mask",
      description: "Restoration mask for dry and damaged length.",
      quote: "Softness should be measurable, not accidental.",
      purchasePrice: "720.00",
      sellingPrice: "1100.00",
      stockQuantity: 4,
      minStockQuantity: 2,
      contentAmount: "250.00",
      contentUnit: ConsumableUnit.ML,
      stockContentAmount: "1210.00",
      productPurpose: "BOTH",
      imageUrl: null
    },
    create: {
      categoryId: categories[2].id,
      brandId: professionalBrand.id,
      name: "Repair mask",
      brand: professionalBrand.name,
      description: "Restoration mask for dry and damaged length.",
      quote: "Softness should be measurable, not accidental.",
      sku: "SL-MASK-001",
      purchasePrice: "720.00",
      sellingPrice: "1100.00",
      stockQuantity: 4,
      minStockQuantity: 2,
      contentAmount: "250.00",
      contentUnit: ConsumableUnit.ML,
      stockContentAmount: "1210.00",
      productPurpose: "BOTH",
      imageUrl: null
    }
  });

  const conditioner = await prisma.product.upsert({
    where: { sku: "SL-SPRAY-001" },
    update: {
      categoryId: categories[1].id,
      brandId: professionalBrand.id,
      brand: professionalBrand.name,
      name: "Betaine conditioner",
      description: "Conditioner for smoothness, shine, and easier combing.",
      quote: "Light care is still serious care.",
      purchasePrice: "700.00",
      sellingPrice: "1050.00",
      stockQuantity: 5,
      minStockQuantity: 3,
      contentAmount: "250.00",
      contentUnit: ConsumableUnit.ML,
      stockContentAmount: "1250.00",
      productPurpose: "BOTH",
      imageUrl: null
    },
    create: {
      categoryId: categories[1].id,
      brandId: professionalBrand.id,
      name: "Betaine conditioner",
      brand: professionalBrand.name,
      description: "Conditioner for smoothness, shine, and easier combing.",
      quote: "Light care is still serious care.",
      sku: "SL-SPRAY-001",
      purchasePrice: "700.00",
      sellingPrice: "1050.00",
      stockQuantity: 5,
      minStockQuantity: 3,
      contentAmount: "250.00",
      contentUnit: ConsumableUnit.ML,
      stockContentAmount: "1250.00",
      productPurpose: "BOTH",
      imageUrl: null
    }
  });

  const peelingProduct = await prisma.product.upsert({
    where: { sku: "NG-PEEL-COOL-060" },
    update: {
      categoryId: categories[2].id,
      brandId: professionalBrand.id,
      brand: professionalBrand.name,
      name: "Cooling scalp peeling",
      description: "Professional peeling for scalp cleansing before care procedures.",
      quote: "A clean scalp makes every treatment more precise.",
      purchasePrice: "1200.00",
      sellingPrice: "1800.00",
      stockQuantity: 2,
      minStockQuantity: 2,
      contentAmount: "60.00",
      contentUnit: ConsumableUnit.ML,
      stockContentAmount: "140.00",
      productPurpose: "PROCEDURE",
      imageUrl: null
    },
    create: {
      categoryId: categories[2].id,
      brandId: professionalBrand.id,
      name: "Cooling scalp peeling",
      brand: professionalBrand.name,
      description: "Professional peeling for scalp cleansing before care procedures.",
      quote: "A clean scalp makes every treatment more precise.",
      sku: "NG-PEEL-COOL-060",
      purchasePrice: "1200.00",
      sellingPrice: "1800.00",
      stockQuantity: 2,
      minStockQuantity: 2,
      contentAmount: "60.00",
      contentUnit: ConsumableUnit.ML,
      stockContentAmount: "140.00",
      productPurpose: "PROCEDURE",
      imageUrl: null
    }
  });

  for (const consumable of [
    { serviceId: coloring.id, productId: shampoo.id, quantity: "25.00", unit: ConsumableUnit.ML },
    { serviceId: scalpPeeling.id, productId: peelingProduct.id, quantity: "20.00", unit: ConsumableUnit.ML },
    { serviceId: reconstruction.id, productId: mask.id, quantity: "30.00", unit: ConsumableUnit.ML }
  ]) {
    await prisma.serviceConsumable.upsert({
      where: { serviceId_productId: { serviceId: consumable.serviceId, productId: consumable.productId } },
      update: { quantity: consumable.quantity, unit: consumable.unit },
      create: consumable
    });
  }

  const sale = await prisma.productSale.upsert({
    where: { id: 1n },
    update: {
      clientId: clients[0].id,
      employeeId: anna.id,
      totalAmount: "1050.00",
      saleDate: atToday(13, 20)
    },
    create: {
      id: 1n,
      clientId: clients[0].id,
      employeeId: anna.id,
      totalAmount: "1050.00",
      saleDate: atToday(13, 20)
    }
  });

  await prisma.productSaleItem.deleteMany({
    where: {
      saleId: sale.id,
      productId: { not: conditioner.id }
    }
  });

  await prisma.productSaleItem.upsert({
    where: { saleId_productId: { saleId: sale.id, productId: conditioner.id } },
    update: { quantity: 1, unitPrice: "1050.00" },
    create: { saleId: sale.id, productId: conditioner.id, quantity: 1, unitPrice: "1050.00" }
  });

  await prisma.payment.upsert({
    where: { productSaleId: sale.id },
    update: { amount: "1050.00", paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PAID, paidAt: atToday(13, 25) },
    create: {
      productSaleId: sale.id,
      amount: "1050.00",
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      paidAt: atToday(13, 25)
    }
  });

  for (const movement of [
    {
      id: 1n,
      productId: shampoo.id,
      movementType: StockMovementType.PURCHASE,
      quantity: 6,
      contentQuantity: "1500.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Initial stock"
    },
    {
      id: 2n,
      productId: shampoo.id,
      movementType: StockMovementType.SALE,
      quantity: 0,
      contentQuantity: "-25.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Procedure write-off: hair coloring"
    },
    {
      id: 3n,
      productId: mask.id,
      movementType: StockMovementType.PURCHASE,
      quantity: 5,
      contentQuantity: "1250.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Initial stock"
    },
    {
      id: 4n,
      productId: mask.id,
      movementType: StockMovementType.SALE,
      quantity: 0,
      contentQuantity: "-25.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Procedure write-off: reconstruction"
    },
    {
      id: 5n,
      productId: mask.id,
      movementType: StockMovementType.SALE,
      quantity: 0,
      contentQuantity: "-15.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Procedure write-off: reconstruction correction"
    },
    {
      id: 6n,
      productId: conditioner.id,
      movementType: StockMovementType.PURCHASE,
      quantity: 6,
      contentQuantity: "1500.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Initial stock"
    },
    {
      id: 7n,
      productId: conditioner.id,
      movementType: StockMovementType.SALE,
      quantity: -1,
      contentQuantity: "-250.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Client retail sale"
    },
    {
      id: 8n,
      productId: peelingProduct.id,
      movementType: StockMovementType.PURCHASE,
      quantity: 3,
      contentQuantity: "180.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Initial stock"
    },
    {
      id: 9n,
      productId: peelingProduct.id,
      movementType: StockMovementType.SALE,
      quantity: 0,
      contentQuantity: "-20.00",
      contentUnit: ConsumableUnit.ML,
      reason: "Procedure write-off: scalp peeling"
    }
  ]) {
    await prisma.stockMovement.upsert({
      where: { id: movement.id },
      update: movement,
      create: movement
    });
  }

  for (const log of [
    {
      id: 1n,
      appointmentId: 4n,
      serviceId: scalpPeeling.id,
      productId: peelingProduct.id,
      quantity: "20.00",
      unit: ConsumableUnit.ML,
      stockContentBefore: "160.00",
      stockContentAfter: "140.00",
      createdAt: atDayOffset(-1, 12, 5)
    },
    {
      id: 2n,
      appointmentId: 5n,
      serviceId: coloring.id,
      productId: shampoo.id,
      quantity: "25.00",
      unit: ConsumableUnit.ML,
      stockContentBefore: "1500.00",
      stockContentAfter: "1475.00",
      createdAt: atDayOffset(-3, 17, 8)
    },
    {
      id: 3n,
      appointmentId: 5n,
      serviceId: reconstruction.id,
      productId: mask.id,
      quantity: "25.00",
      unit: ConsumableUnit.ML,
      stockContentBefore: "1250.00",
      stockContentAfter: "1225.00",
      createdAt: atDayOffset(-3, 17, 9)
    },
    {
      id: 4n,
      appointmentId: 6n,
      serviceId: reconstruction.id,
      productId: mask.id,
      quantity: "15.00",
      unit: ConsumableUnit.ML,
      stockContentBefore: "1225.00",
      stockContentAfter: "1210.00",
      createdAt: atDayOffset(-8, 12, 35)
    }
  ]) {
    await prisma.serviceConsumptionLog.upsert({
      where: { id: log.id },
      update: log,
      create: log
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
    "product_brands",
    "product_sales",
    "stock_movements",
    "service_consumables",
    "service_consumption_logs",
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
