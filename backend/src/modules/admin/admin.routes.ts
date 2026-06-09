import { Router } from "express";
import {
  createProduct,
  createProductSale,
  createService,
  createServiceCategory,
  getAppointments,
  getClients,
  getDashboard,
  getEmployees,
  getPayments,
  getPortfolio,
  getProductSales,
  getProducts,
  getReviews,
  getServiceCategories,
  getServices,
  getSettings,
  updateAppointment,
  updatePayment,
  updateProduct,
  updateService,
  updateServiceCategory,
  updateSettings
} from "./admin.service.js";
import {
  createProductSchema,
  createSaleSchema,
  createServiceSchema,
  createServiceCategorySchema,
  updateAppointmentSchema,
  updatePaymentSchema,
  updateProductSchema,
  updateServiceCategorySchema,
  updateServiceSchema,
  updateSettingsSchema
} from "./admin.schemas.js";

export const adminRouter = Router();

adminRouter.get("/admin/dashboard", async (_request, response, next) => {
  try {
    response.json({ data: await getDashboard() });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/appointments", async (_request, response, next) => {
  try {
    response.json({ data: await getAppointments() });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/appointments/:id", async (request, response, next) => {
  try {
    const body = updateAppointmentSchema.parse(request.body);
    response.json({ data: await updateAppointment(BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/clients", async (request, response, next) => {
  try {
    response.json({ data: await getClients(typeof request.query.search === "string" ? request.query.search : undefined) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/services", async (_request, response, next) => {
  try {
    response.json({ data: await getServices() });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/services", async (request, response, next) => {
  try {
    const body = createServiceSchema.parse(request.body);
    response.status(201).json({ data: await createService(body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/services/:id", async (request, response, next) => {
  try {
    const body = updateServiceSchema.parse(request.body);
    response.json({ data: await updateService(BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/service-categories", async (_request, response, next) => {
  try {
    response.json({ data: await getServiceCategories() });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/service-categories", async (request, response, next) => {
  try {
    const body = createServiceCategorySchema.parse(request.body);
    response.status(201).json({ data: await createServiceCategory(body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/service-categories/:id", async (request, response, next) => {
  try {
    const body = updateServiceCategorySchema.parse(request.body);
    response.json({ data: await updateServiceCategory(BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/employees", async (_request, response, next) => {
  try {
    response.json({ data: await getEmployees() });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/portfolio", async (_request, response, next) => {
  try {
    response.json({ data: await getPortfolio() });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/products", async (_request, response, next) => {
  try {
    response.json({ data: await getProducts() });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/products", async (request, response, next) => {
  try {
    const body = createProductSchema.parse(request.body);
    response.status(201).json({ data: await createProduct(body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/products/:id", async (request, response, next) => {
  try {
    const body = updateProductSchema.parse(request.body);
    response.json({ data: await updateProduct(BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/sales", async (_request, response, next) => {
  try {
    response.json({ data: await getProductSales() });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/sales", async (request, response, next) => {
  try {
    const body = createSaleSchema.parse(request.body);
    response.status(201).json({ data: await createProductSale(body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/payments", async (_request, response, next) => {
  try {
    response.json({ data: await getPayments() });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/payments/:id", async (request, response, next) => {
  try {
    const body = updatePaymentSchema.parse(request.body);
    response.json({ data: await updatePayment(BigInt(request.params.id), body) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/reviews", async (_request, response, next) => {
  try {
    response.json({ data: await getReviews() });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/settings", async (_request, response, next) => {
  try {
    response.json({ data: await getSettings() });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/settings", async (request, response, next) => {
  try {
    const body = updateSettingsSchema.parse(request.body);
    response.json({ data: await updateSettings(body) });
  } catch (error) {
    next(error);
  }
});
