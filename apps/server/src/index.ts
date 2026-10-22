import { app } from "@/app";
import { config } from "@kuki/config";

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
