import { Router } from "express";
import { createStoreOrder, createStoreReview, getEmployees, getPopularProducts, getPortfolio, getProduct, getProducts, getServices, getStoreOrderPaymentStatus, getStoreReviews, payStoreOrder } from "./catalog.service.js";
import { parseIdList } from "../../utils/time.js";
import { storeOrderSchema, storeReviewSchema } from "./catalog.schemas.js";

export const catalogRouter = Router();

catalogRouter.get("/services", async (_request, response, next) => {
  try {
    response.json({ data: await getServices() });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/employees", async (request, response, next) => {
  try {
    response.json({ data: await getEmployees(parseIdList(request.query.serviceIds)) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/portfolio", async (_request, response, next) => {
  try {
    response.json({ data: await getPortfolio() });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/products", async (_request, response, next) => {
  try {
    response.json({ data: await getProducts() });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/public/products", async (_request, response, next) => {
  try {
    response.json({ data: await getProducts() });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/public/popular-products", async (_request, response, next) => {
  try {
    response.json({ data: await getPopularProducts() });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/public/store-reviews", async (_request, response, next) => {
  try {
    response.json({ data: await getStoreReviews() });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/public/store-reviews", async (request, response, next) => {
  try {
    response.status(201).json({ data: await createStoreReview(storeReviewSchema.parse(request.body)) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/public/orders", async (request, response, next) => {
  try {
    response.status(201).json({ data: await createStoreOrder(storeOrderSchema.parse(request.body)) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/public/orders/:id/payment-status", async (request, response, next) => {
  try {
    response.json({ data: await getStoreOrderPaymentStatus(request.params.id) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/public/orders/:id/pay", async (request, response, next) => {
  try {
    response.json({ data: await payStoreOrder(request.params.id) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/public/products/:id", async (request, response, next) => {
  try {
    response.json({ data: await getProduct(request.params.id) });
  } catch (error) {
    next(error);
  }
});
