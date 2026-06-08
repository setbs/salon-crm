import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Salon CRM API is running on http://localhost:${env.PORT}`);
});
