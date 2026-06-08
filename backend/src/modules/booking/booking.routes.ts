import { Router } from "express";
import { parseIdList } from "../../utils/time.js";
import { bookAppointment, getAvailability } from "./booking.service.js";
import { availabilityQuerySchema, createAppointmentSchema } from "./booking.schemas.js";

export const bookingRouter = Router();

bookingRouter.get("/availability", async (request, response, next) => {
  try {
    const query = availabilityQuerySchema.parse(request.query);
    response.json({
      data: await getAvailability({
        employeeId: BigInt(query.employeeId),
        serviceIds: parseIdList(query.serviceIds),
        date: query.date
      })
    });
  } catch (error) {
    next(error);
  }
});

bookingRouter.post("/appointments", async (request, response, next) => {
  try {
    const body = createAppointmentSchema.parse(request.body);
    response.status(201).json({ data: await bookAppointment(body) });
  } catch (error) {
    next(error);
  }
});
