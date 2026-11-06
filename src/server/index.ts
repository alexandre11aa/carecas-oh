// src/server/index.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
// Compilado em dist/server/server/index.js; o frontend fica em dist/client.
const clientDir = process.env.CLIENT_DIR ?? path.resolve(here, "../../client");

const { httpServer } = createApp({ clientDir });

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Servidor escutando em 0.0.0.0:${port}`);
});
