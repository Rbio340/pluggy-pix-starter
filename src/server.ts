// src/server.ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { CONFIG } from "./config";
import registerPix from "./routes/pix";
import registerEnrich from "./routes/enrich";
import registerTx from "./routes/transactions";
import registerItems from "./routes/items";
import registerAccounts from "./routes/account";
import { PluggyClient } from "./pluggy";
import registerSandbox from "./routes/sandbox";

const app = new OpenAPIHono();

app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT", // opcional
});

app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "Pluggy PIX Starter",
    version: "1.0.0",
    description:
      "API para transacciones, enriquecimiento y pagos PIX vía Pluggy",
  },
});

// UI de Swagger en /docs
app.get("/docs", swaggerUI({ url: "/doc" }));

// Endpoints
registerPix(app);
registerEnrich(app);
registerTx(app);
registerItems(app);
registerAccounts(app);
registerSandbox(app);

// Health
app.get("/", (c) => c.json({ ok: true, service: "pluggy-pix-starter" }));

// DEBUG TEMPORAL
app.get("/debug/env", (c) =>
  c.json({
    clientIdPresent: !!process.env.PLUGGY_CLIENT_ID,
    secretPresent: !!process.env.PLUGGY_SECRET,
    baseUrl: process.env.PLUGGY_BASE_URL || "https://api.pluggy.ai",
  })
);

app.get("/debug/env", (c) =>
  c.json({
    baseUrl: process.env.PLUGGY_BASE_URL || "https://api.pluggy.ai",
    hasClientId: !!process.env.PLUGGY_CLIENT_ID,
    hasSecret: !!process.env.PLUGGY_SECRET,
  })
);

app.get("/debug/auth", async (c) => {
  try {
    const cli = new PluggyClient();
    const info = await cli.debugAuth();
    return c.json({ ok: true, ...info });
  } catch (e: any) {
    return c.json(
      {
        ok: false,
        error: e?.message ?? String(e),
        hasClientId: !!process.env.PLUGGY_CLIENT_ID,
        hasSecret: !!process.env.PLUGGY_SECRET,
      },
      500
    );
  }
});

serve({ fetch: app.fetch, port: CONFIG.PORT }, () => {
  console.log(`🚀 API running on http://localhost:${CONFIG.PORT}`);
  console.log(`📘 Swagger UI:      http://localhost:${CONFIG.PORT}/docs`);
  console.log(`📄 OpenAPI (JSON):  http://localhost:${CONFIG.PORT}/doc`);
});
