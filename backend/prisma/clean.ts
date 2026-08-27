import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRESERVED_DATA = ["users", "employees"];

async function main() {
  if (process.env.ALLOW_DB_CLEAN !== "true") {
    throw new Error("Refusing to clean database. Run with ALLOW_DB_CLEAN=true npm run db:clean");
  }

  const results = await prisma.$transaction(
    async (transaction) => [
      await transaction.paymentAuditLog.deleteMany(),
      await transaction.appointmentAuditLog.deleteMany(),
      await transaction.notificationLog.deleteMany(),
      await transaction.reportExportLog.deleteMany(),

      await transaction.serviceConsumptionLog.deleteMany(),
      await transaction.serviceConsumable.deleteMany(),
      await transaction.appointmentService.deleteMany(),
      await transaction.productSaleItem.deleteMany(),
      await transaction.storeOrderItem.deleteMany(),
      await transaction.productComponentItem.deleteMany(),

      await transaction.review.deleteMany(),
      await transaction.payment.deleteMany(),
      await transaction.stockMovement.deleteMany(),

      await transaction.appointment.deleteMany(),
      await transaction.productSale.deleteMany(),
      await transaction.storeOrder.deleteMany(),

      await transaction.clientNote.deleteMany(),
      await transaction.clientEmailAlias.deleteMany(),
      await transaction.clientNameAlias.deleteMany(),

      await transaction.portfolioPhoto.deleteMany(),
      await transaction.workingHour.deleteMany(),
      await transaction.employeeTimeOff.deleteMany(),
      await transaction.employeeScheduleOverride.deleteMany(),
      await transaction.employeeService.deleteMany(),

      await transaction.product.deleteMany(),
      await transaction.productComponent.deleteMany(),
      await transaction.productBrand.deleteMany(),
      await transaction.productCategory.deleteMany(),

      await transaction.service.deleteMany(),
      await transaction.serviceCategory.deleteMany(),

      await transaction.storeReview.deleteMany(),
      await transaction.businessHour.deleteMany(),
      await transaction.salonSetting.deleteMany()
    ],
    { timeout: 30_000 }
  );

  const deletedRows = results.reduce((sum, result) => sum + result.count, 0);

  console.log(`Database cleaned successfully. Deleted ${deletedRows} rows.`);
  console.log(`Admin/auth data preserved: ${PRESERVED_DATA.join(", ")}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
