import { z, OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { PluggyClient } from '../pluggy';

const Query = z.object({
  page: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
  pageSize: z.coerce.number().int().positive().optional().openapi({ example: 50 })
});

const route = createRoute({
  method: 'get',
  path: '/items',
  request: { query: Query },
  responses: {
    200: { description: 'Listado de items', content: { 'application/json': { schema: z.any() } } },
    500: { description: 'Pluggy error' }
  },
  tags: ['Lookup']
});

export default function registerItems(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    try {
      const q = c.req.valid('query');
      const client = new PluggyClient();
      const data = await client.getItems(q);
      return c.json(data);
    } catch (e: any) {
      console.error('GET /items error:', e);
      return c.json({ error: e?.message ?? String(e) }, 500);
    }
  });
}
