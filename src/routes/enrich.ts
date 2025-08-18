import { z, OpenAPIHono, createRoute } from '@hono/zod-openapi';

const Tx = z.object({
  id: z.string().openapi({ example: 'tx_1001' }),
  date: z.string().openapi({ example: '2025-08-16' }),
  description: z.string().default('').openapi({ example: 'Cafetería Doña Ana' }),
  currency: z.string().default('BRL').openapi({ example: 'BRL' }),
  amount: z.number().openapi({ example: -22.9 }),
  category: z.string().default('Uncategorized').openapi({ example: 'Food & Drink' })
}).openapi('TransactionIn');

const EnrichBody = z.object({
  data: z.array(Tx)
}).openapi('EnrichBody');

const EnrichedTx = Tx.extend({
  merchant: z.string().openapi({ example: 'Cafetería Doña Ana' }),
  normalizedAmount: z.number().openapi({ example: -22.9 }),
  inferredCategory: z.string().openapi({ example: 'Food & Drink' })
}).openapi('TransactionOut');

const route = createRoute({
  method: 'post',
  path: '/enrich',
  request: {
    body: { content: { 'application/json': { schema: EnrichBody } }, required: true }
  },
  responses: {
    200: {
      description: 'Transacciones enriquecidas',
      content: { 'application/json': { schema: z.array(EnrichedTx) } }
    },
    400: { description: 'Bad Request' }
  },
  tags: ['Utils']
});

function guessMerchant(desc: string) {
  const m = desc.match(/([a-zA-ZÀ-ÿ\\s]{3,})/);
  return m ? m[1].trim() : 'Unknown';
}
function inferCategory(desc: string, amount: number) {
  const d = desc.toLowerCase();
  if (d.includes('uber') || d.includes('99')) return 'Transport';
  if (d.includes('mercado') || d.includes('super') || d.includes('market')) return 'Groceries';
  if (d.includes('pix')) return 'Transfer';
  if (d.includes('café') || d.includes('cafeter') || d.includes('coffee')) return 'Food & Drink';
  if (amount > 0) return 'Income';
  return 'Uncategorized';
}

export default function registerEnrich(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const { data } = await c.req.json();
    const enriched = data.map((t: any) => ({
      ...t,
      merchant: guessMerchant(t.description),
      normalizedAmount: Number(t.amount.toFixed(2)),
      inferredCategory: inferCategory(t.description, t.amount)
    }));
    return c.json(enriched);
  });
}
