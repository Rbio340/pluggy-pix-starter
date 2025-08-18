import { z, OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { PluggyClient } from '../pluggy';

const Params = z.object({
  itemId: z.string().openapi({ example: '123456' })
});

const route = createRoute({
  method: 'get',
  path: '/accounts/{itemId}',
  request: { params: Params },
  responses: {
    200: { description: 'Cuentas del item', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Item no encontrado' }
  },
  tags: ['Lookup']
});

export default function registerAccounts(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    try {
      const { itemId } = c.req.valid('param');
      const client = new PluggyClient();
      const res = await client.getAccountsByItem(itemId);
      return c.json(res);
    } catch (e: any) {
      console.error('GET /accounts/:itemId error:', e);
      return c.json({ error: e?.message ?? String(e) }, 500);
    }
  });
}

