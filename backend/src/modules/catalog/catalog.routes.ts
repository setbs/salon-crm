import { Router } from "express";
import { getEmployees, getPortfolio, getProducts, getServices } from "./catalog.service.js";
import { parseIdList } from "../../utils/time.js";

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
