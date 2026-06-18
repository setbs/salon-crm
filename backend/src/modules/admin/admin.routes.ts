import { Router, raw } from "express";
import { getAuthenticatedUser, requireCrmUser } from "../auth/auth.middleware.js";
import {
  createEmployee,
  createEmployeeTimeOff,
  createPortfolioPhoto,
  createProduct,
  createProductBrand,
  createProductCategory,
  createProductSale,
  createAppointment,
  createService,
  createServiceCategory,
  createStockMovement,
  deleteService,
  deleteServiceCategory,
  deleteEmployeeTimeOff,
  deletePortfolioPhoto,
  deleteProduct,
  deleteProductBrand,
  deleteProductCategory,
  getAppointmentConsumablePreview,
  getClientProfile,
  getAppointments,
  getClients,
  getConsumableAnalytics,
  getDashboard,
  getEmployees,
  getPayments,
  getPortfolio,
  getProductBrands,
  getProductCategories,
  getProductSales,
  getProducts,
  getReviews,
  getServiceCategories,
  getServices,
  getSettings,
  updateAppointment,
  updateEmployee,
  updateEmployeeWorkingHours,
  updatePayment,
  updatePortfolioPhoto,
  updateProduct,
  updateProductBrand,
  updateProductCategory,
  updateService,
  updateServiceCategory,
  updateSettings,
  uploadPortfolioImage,
  uploadProductImage
} from "./admin.service.js";
import {
  createEmployeeSchema,
  createEmployeeTimeOffSchema,
  createPortfolioPhotoSchema,
  createProductBrandSchema,
  createProductCategorySchema,
  createProductSchema,
  createAppointmentSchema,
  createSaleSchema,
  createServiceSchema,
  createServiceCategorySchema,
  createStockMovementSchema,
  updateAppointmentSchema,
  updateEmployeeSchema,
  updateEmployeeWorkingHoursSchema,
  updatePaymentSchema,
  updatePortfolioPhotoSchema,
  updateProductBrandSchema,
  updateProductCategorySchema,
  updateProductSchema,
  updateServiceCategorySchema,
  updateServiceSchema,
  updateSettingsSchema
} from "./admin.schemas.js";

export const adminRouter = Router();

adminRouter.use("/admin", requireCrmUser);

adminRouter.get("/admin/dashboard", async (request, response, next) => {
  try {
    response.json({ data: await getDashboard(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/consumable-analytics", async (request, response, next) => {
  try {
    response.json({ data: await getConsumableAnalytics(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/appointments", async (request, response, next) => {
  try {
    response.json({ data: await getAppointments(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/appointments", async (request, response, next) => {
  try {
    const body = createAppointmentSchema.parse(request.body);
    response.status(201).json({ data: await createAppointment(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/appointments/:id/consumables-preview", async (request, response, next) => {
  try {
    response.json({ data: await getAppointmentConsumablePreview(getAuthenticatedUser(request), BigInt(request.params.id)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/appointments/:id", async (request, response, next) => {
  try {
    const body = updateAppointmentSchema.parse(request.body);
    response.json({ data: await updateAppointment(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/clients", async (request, response, next) => {
  try {
    response.json({ data: await getClients(getAuthenticatedUser(request), typeof request.query.search === "string" ? request.query.search : undefined) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/clients/:id", async (request, response, next) => {
  try {
    response.json({ data: await getClientProfile(getAuthenticatedUser(request), BigInt(request.params.id)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/services", async (request, response, next) => {
  try {
    response.json({ data: await getServices(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/services", async (request, response, next) => {
  try {
    const body = createServiceSchema.parse(request.body);
    response.status(201).json({ data: await createService(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/services/:id", async (request, response, next) => {
  try {
    const body = updateServiceSchema.parse(request.body);
    response.json({ data: await updateService(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/admin/services/:id", async (request, response, next) => {
  try {
    await deleteService(getAuthenticatedUser(request), BigInt(request.params.id));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/service-categories", async (request, response, next) => {
  try {
    response.json({ data: await getServiceCategories(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/service-categories", async (request, response, next) => {
  try {
    const body = createServiceCategorySchema.parse(request.body);
    response.status(201).json({ data: await createServiceCategory(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/service-categories/:id", async (request, response, next) => {
  try {
    const body = updateServiceCategorySchema.parse(request.body);
    response.json({ data: await updateServiceCategory(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/admin/service-categories/:id", async (request, response, next) => {
  try {
    await deleteServiceCategory(getAuthenticatedUser(request), BigInt(request.params.id));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/employees", async (request, response, next) => {
  try {
    response.json({ data: await getEmployees(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/employees", async (request, response, next) => {
  try {
    const body = createEmployeeSchema.parse(request.body);
    response.status(201).json({ data: await createEmployee(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/employees/:id", async (request, response, next) => {
  try {
    const body = updateEmployeeSchema.parse(request.body);
    response.json({ data: await updateEmployee(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/employees/:id/working-hours", async (request, response, next) => {
  try {
    const body = updateEmployeeWorkingHoursSchema.parse(request.body);
    response.json({ data: await updateEmployeeWorkingHours(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/employees/:id/time-off", async (request, response, next) => {
  try {
    const body = createEmployeeTimeOffSchema.parse(request.body);
    response.status(201).json({ data: await createEmployeeTimeOff(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/admin/employees/:employeeId/time-off/:timeOffId", async (request, response, next) => {
  try {
    await deleteEmployeeTimeOff(getAuthenticatedUser(request), BigInt(request.params.employeeId), BigInt(request.params.timeOffId));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/portfolio", async (request, response, next) => {
  try {
    response.json({ data: await getPortfolio(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/uploads/portfolio", raw({ limit: "6mb", type: ["image/jpeg", "image/png", "image/webp", "image/gif"] }), async (request, response, next) => {
  try {
    if (!Buffer.isBuffer(request.body)) {
      response.status(400).json({ message: "Image upload body is required." });
      return;
    }

    response.status(201).json({
      data: await uploadPortfolioImage(getAuthenticatedUser(request), {
        contentType: request.headers["content-type"] ?? "",
        buffer: request.body
      })
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/portfolio", async (request, response, next) => {
  try {
    const body = createPortfolioPhotoSchema.parse(request.body);
    response.status(201).json({ data: await createPortfolioPhoto(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/portfolio/:id", async (request, response, next) => {
  try {
    const body = updatePortfolioPhotoSchema.parse(request.body);
    response.json({ data: await updatePortfolioPhoto(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/admin/portfolio/:id", async (request, response, next) => {
  try {
    await deletePortfolioPhoto(getAuthenticatedUser(request), BigInt(request.params.id));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/uploads/products", raw({ limit: "6mb", type: ["image/jpeg", "image/png", "image/webp", "image/gif"] }), async (request, response, next) => {
  try {
    if (!Buffer.isBuffer(request.body)) {
      response.status(400).json({ message: "Image upload body is required." });
      return;
    }

    response.status(201).json({
      data: await uploadProductImage(getAuthenticatedUser(request), {
        contentType: request.headers["content-type"] ?? "",
        buffer: request.body
      })
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/product-categories", async (request, response, next) => {
  try {
    response.json({ data: await getProductCategories(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/product-categories", async (request, response, next) => {
  try {
    const body = createProductCategorySchema.parse(request.body);
    response.status(201).json({ data: await createProductCategory(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/product-categories/:id", async (request, response, next) => {
  try {
    const body = updateProductCategorySchema.parse(request.body);
    response.json({ data: await updateProductCategory(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/admin/product-categories/:id", async (request, response, next) => {
  try {
    await deleteProductCategory(getAuthenticatedUser(request), BigInt(request.params.id));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/product-brands", async (request, response, next) => {
  try {
    response.json({ data: await getProductBrands(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/product-brands", async (request, response, next) => {
  try {
    const body = createProductBrandSchema.parse(request.body);
    response.status(201).json({ data: await createProductBrand(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/product-brands/:id", async (request, response, next) => {
  try {
    const body = updateProductBrandSchema.parse(request.body);
    response.json({ data: await updateProductBrand(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/admin/product-brands/:id", async (request, response, next) => {
  try {
    await deleteProductBrand(getAuthenticatedUser(request), BigInt(request.params.id));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/products", async (request, response, next) => {
  try {
    response.json({ data: await getProducts(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/products", async (request, response, next) => {
  try {
    const body = createProductSchema.parse(request.body);
    response.status(201).json({ data: await createProduct(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/products/:id", async (request, response, next) => {
  try {
    const body = updateProductSchema.parse(request.body);
    response.json({ data: await updateProduct(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/admin/products/:id", async (request, response, next) => {
  try {
    await deleteProduct(getAuthenticatedUser(request), BigInt(request.params.id));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/stock-movements", async (request, response, next) => {
  try {
    const body = createStockMovementSchema.parse(request.body);
    response.status(201).json({ data: await createStockMovement(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/sales", async (request, response, next) => {
  try {
    response.json({ data: await getProductSales(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/sales", async (request, response, next) => {
  try {
    const body = createSaleSchema.parse(request.body);
    response.status(201).json({ data: await createProductSale(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/payments", async (request, response, next) => {
  try {
    response.json({ data: await getPayments(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/payments/:id", async (request, response, next) => {
  try {
    const body = updatePaymentSchema.parse(request.body);
    response.json({ data: await updatePayment(getAuthenticatedUser(request), BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/reviews", async (request, response, next) => {
  try {
    response.json({ data: await getReviews(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/settings", async (request, response, next) => {
  try {
    response.json({ data: await getSettings(getAuthenticatedUser(request)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/settings", async (request, response, next) => {
  try {
    const body = updateSettingsSchema.parse(request.body);
    response.json({ data: await updateSettings(getAuthenticatedUser(request), body) });
  } catch (error) {
    next(error);
  }
});
