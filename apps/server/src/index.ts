import { app } from "@/app";

export default {
  port: Number(process.env.PORT ?? 4000),
  fetch: app.fetch,
};
