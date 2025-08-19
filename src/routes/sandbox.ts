import { z, OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { PluggyClient } from "../pluggy";

// POST /sandbox/items  -> crea Item sandbox (conector 2, user-ok/password-ok por defecto)
const CreateItemBody = z.object({
  connectorId: z.number().int().positive().default(2).openapi({ example: 2 }),
  parameters: z
    .object({
      user: z.string().default("user-ok").openapi({ example: "user-ok" }),
      password: z.string().default("password-ok").openapi({ example: "password-ok" }),
    })
    .passthrough()
    .default({ user: "user-ok", password: "password-ok" }),
  webhookUrl: z.string().url().optional().openapi({ example: "https://example.com/webhook" }),
});

const createItemRoute = createRoute({
  method: "post",
  path: "/sandbox/items",
  request: {
    body: { required: true, content: { "application/json": { schema: CreateItemBody } } },
  },
  responses: {
    201: { description: "Item creado", content: { "application/json": { schema: z.any() } } },
    400: { description: "Bad Request" },
    403: { description: "CREATE_ITEMS_API_FREE_DISABLED (usa widget)" },
  },
  tags: ["Sandbox"],
});

const GetItemParams = z.object({
  itemId: z.string().openapi({ example: "123456" }),
});
const getItemRoute = createRoute({
  method: "get",
  path: "/sandbox/items/{itemId}",
  request: { params: GetItemParams },
  responses: {
    200: { description: "Item", content: { "application/json": { schema: z.any() } } },
  },
  tags: ["Sandbox"],
});

const WaitQuery = z.object({
  intervalMs: z.coerce.number().int().positive().default(2000).openapi({ example: 2000 }),
  maxTries: z.coerce.number().int().positive().default(15).openapi({ example: 15 }),
});
const waitRoute = createRoute({
  method: "get",
  path: "/sandbox/items/{itemId}/wait",
  request: { params: GetItemParams, query: WaitQuery },
  responses: {
    200: { description: "Item listo (UPDATED/OUTDATED/LOGIN_ERROR)", content: { "application/json": { schema: z.any() } } },
    202: { description: "Timeout esperando al Item", content: { "application/json": { schema: z.any() } } },
  },
  tags: ["Sandbox"],
});

export default function registerSandbox(app: OpenAPIHono) {
  // POST /sandbox/items
  app.openapi(createItemRoute, async (c) => {
    const body = c.req.valid("json");
    const cli = new PluggyClient(); 
    try {
      const item = await cli.createItem(body);
      return c.json(item, 201);
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg.includes("CREATE_ITEMS_API_FREE_DISABLED") ? 403 : 400;
      return c.json({ error: msg }, code);
    }
  });

  // GET /sandbox/items/{itemId}
  app.openapi(getItemRoute, async (c) => {
    const { itemId } = c.req.valid("param");
    const cli = new PluggyClient();
    const item = await cli.getItem(itemId);
    return c.json(item);
  });

  // GET /sandbox/items/{itemId}/wait
  app.openapi(waitRoute, async (c) => {
    const { itemId } = c.req.valid("param");
    const { intervalMs, maxTries } = c.req.valid("query");
    const cli = new PluggyClient();

    let last: any = null;
    for (let i = 0; i < maxTries; i++) {
      const item = await cli.getItem(itemId);
      last = item;
      const s = (item?.status || "").toUpperCase();
      if (["UPDATED", "OUTDATED", "LOGIN_ERROR"].includes(s)) {
        return c.json(item, 200);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return c.json({ timeout: true, last }, 202);
  });
}
