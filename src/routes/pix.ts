import { z, OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { PluggyClient } from '../pluggy';
import { CONFIG } from '../config';

const PixBody = z.object({
  fromAccountId: z.string().min(1).openapi({ example: 'preauth_abc123' }), // preauthorizationId
  toAccountId: z.string().min(1).openapi({ example: 'recipient_xyz789' }), // recipientId
  amount: z.number().positive().openapi({ example: 100 }),
  description: z.string().optional().openapi({ example: 'PIX via Smart Transfers' }),
}).openapi('PixTransferBody');

const PixResult = z.object({
  id: z.string().openapi({ example: 'pay_123' }),
  status: z.string().openapi({ example: 'CREATED' }),
}).openapi('PixTransferResult');

const HeadersSchema = z.object({
  authorization: z.string().optional().openapi({ example: 'Bearer supersecreto123' }),
});

const route = createRoute({
  method: 'post',
  path: '/pix/transfer',
  security: [{ bearerAuth: [] }],
  request: {
    headers: HeadersSchema,
    body: {
      content: { 'application/json': { schema: PixBody } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'PIX transfer creada',
      content: { 'application/json': { schema: PixResult } },
    },
    401: { description: 'Unauthorized' },
    400: { description: 'Bad Request' },
  },
  tags: ['PIX'],
});

export default function registerPix(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const auth = c.req.header('authorization'); // o usa c.req.valid('header') si prefieres
    if (CONFIG.API_SECRET_KEY && auth !== `Bearer ${CONFIG.API_SECRET_KEY}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const body = await c.req.json();
    const client = new PluggyClient();
    const res = await client.createPixTransfer(body);
    return c.json(res, 201);
  });
}
