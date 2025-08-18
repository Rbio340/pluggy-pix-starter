import { z, OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { PluggyClient } from '../pluggy';

const Params = z.object({
  accountId: z.string().openapi({ example: 'ITEMID_ACCOUNTID' })
});
const Query = z.object({
  from: z.string().optional().openapi({ example: '2025-08-01' }),
  to: z.string().optional().openapi({ example: '2025-08-16' }),
  page: z.coerce.number().int().positive().optional().openapi({ example: 1 }),
  pageSize: z.coerce.number().int().positive().optional().openapi({ example: 100 }),
  latest: z.coerce.boolean().optional().openapi({ example: false })
});

const route = createRoute({
  method: 'get',
  path: '/transactions/{accountId}',
  request: {
    params: Params,
    query: Query
  },
  responses: {
    200: {
      description: 'Listado de transacciones (paginado) o última si latest=true',
      content: { 'application/json': { schema: z.any() } }
    },
    400: { description: 'Bad Request' }
  },
  tags: ['Transactions']
});

export default function registerTx(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { accountId } = c.req.valid('param');
    const query = c.req.valid('query');
    const client = new PluggyClient();
    const data = await client.getTransactions(accountId, query);
    return c.json(data);
  });
}
