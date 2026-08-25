import { Router } from "express";
import { handleMonobankWebhook } from "./monobank.service.js";

export const monobankWebhookRouter = Router();

monobankWebhookRouter.post("/webhook", async (request, response, next) => {
  try {
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from(JSON.stringify(request.body ?? {}));
    response.json(await handleMonobankWebhook(body, request.header("X-Sign") ?? undefined));
  } catch (error) {
    next(error);
  }
});
