import { CONFIG } from "./config";

type AuthResponse = { apiKey: string; expiresAt?: string };
type ListResponse<T> = { results: T[]; page?: number; total?: number; totalPages: number };
type Transaction = {
  id: string | number;
  accountId: string | number;
  description?: string;
  date?: string;
  amount?: number;
  currencyCode?: string;
  [k: string]: unknown;
};

const mask = (s?: string, keep = 4) =>
  !s ? "(empty)" : s.length <= keep ? s : `${s.slice(0, 2)}***${s.slice(-keep)}`;

export class PluggyClient {
  #apiKey?: string;
  #apiKeyExp?: number;

  constructor(
    private baseUrl = CONFIG.PLUGGY_BASE_URL,
    private clientId = CONFIG.PLUGGY_CLIENT_ID,
    private clientSecret = CONFIG.PLUGGY_SECRET
  ) {
    console.log("[pluggy] init", {
      baseUrl: this.baseUrl,
      clientId: mask(this.clientId),
      secret: mask(this.clientSecret),
    });
  }

  #isApiKeyValid() {
    return !!this.#apiKey && !!this.#apiKeyExp && this.#apiKeyExp > Date.now() + 30_000;
  }

  async #fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.#isApiKeyValid()) {
      console.log("[pluggy] apiKey invalid/absent -> fetching /auth");
      await this.#getApiKey();
    } else {
      console.log("[pluggy] using cached apiKey", {
        prefix: this.#apiKey?.slice(0, 8),
        expISO: new Date(this.#apiKeyExp!).toISOString(),
      });
    }

    const method = (init?.method || "GET").toUpperCase();
    console.log(`[pluggy] FETCH ${method} ${path}`, {
      hasKey: !!this.#apiKey,
      keyPrefix: this.#apiKey?.slice(0, 8),
    });

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": this.#apiKey as string,
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[pluggy] ${method} ${path} -> ${res.status}`, text);
      throw new Error(`Pluggy ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async #getApiKey() {
    console.log("[pluggy] POST /auth", {
      clientId: mask(this.clientId),
      secret: mask(this.clientSecret),
    });
    const res = await fetch(`${this.baseUrl}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[pluggy] /auth FAILED", res.status, text);
      throw new Error(`/auth failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as AuthResponse;
    this.#apiKey = data.apiKey;
    this.#apiKeyExp = data.expiresAt
      ? new Date(data.expiresAt).getTime()
      : Date.now() + 100 * 60 * 1000;

    console.log("[pluggy] /auth OK", {
      keyPrefix: this.#apiKey.slice(0, 8),
      expISO: new Date(this.#apiKeyExp).toISOString(),
    });

    return this.#apiKey;
  }

  // 🔍 Endpoint de debug lo usará
  async debugAuth() {
    const key = await this.#getApiKey();
    return { keyPrefix: key.slice(0, 8), expISO: new Date(this.#apiKeyExp!).toISOString() };
  }

  #parseCompositeAccountId(id: string) {
    if (id.includes("_")) {
      const [itemId, accountId] = id.split("_");
      if (!itemId || !accountId) throw new Error("Formato esperado: itemId_accountId");
      return { itemId, accountId };
    }
    return { itemId: undefined, accountId: id };
  }

  async getTransactions(
    accountIdOrComposite: string,
    opts?: { from?: string; to?: string; page?: number; pageSize?: number; latest?: boolean }
  ) {
    const { accountId } = this.#parseCompositeAccountId(accountIdOrComposite);
    const params = new URLSearchParams({ accountId: String(accountId) });
    if (opts?.from) params.set("from", opts.from);
    if (opts?.to) params.set("to", opts.to);
    params.set("page", String(opts?.page ?? 1));
    params.set("pageSize", String(opts?.pageSize ?? 100));

    const data = await this.#fetchApi<ListResponse<Transaction>>(`/transactions?${params.toString()}`);
    const results = data.results ?? [];
    return opts?.latest ? results[0] ?? null : data;
  }

  async createPixTransfer({
    fromAccountId, toAccountId, amount, description,
  }: { fromAccountId: string; toAccountId: string; amount: number; description?: string }) {
    const payload = {
      preauthorizationId: fromAccountId,
      recipientId: toAccountId,
      amount,
      description: description ?? "PIX via Smart Transfers",
    };
    return this.#fetchApi<any>(`/smart-transfers/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((resp) => ({ id: resp?.id, status: resp?.status ?? "CREATED", raw: resp }));
  }

  async enrichTransactions(transactions: Transaction[]) {
    const payload = { data: transactions.map(this.#mapTxForEnrich) };
    const res = await fetch(`${CONFIG.BACKEND_URL}/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`/enrich failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  #mapTxForEnrich(tx: Transaction) {
    return {
      id: String(tx.id),
      date: tx.date ?? new Date().toISOString().slice(0, 10),
      description: tx.description ?? "",
      currency: tx.currencyCode ?? "BRL",
      amount: typeof tx.amount === "number" ? tx.amount : 0,
      category: "Uncategorized",
    };
  }

  async getItems(opts?: { page?: number; pageSize?: number }) {
    const params = new URLSearchParams();
    params.set("page", String(opts?.page ?? 1));
    params.set("pageSize", String(opts?.pageSize ?? 50));
    return this.#fetchApi<{ results: any[]; page: number; total: number; totalPages: number }>(
      `/items?${params.toString()}`
    );
  }

  async getAccountsByItem(itemId: string | number) {
    return this.#fetchApi<{ results: any[] }>(`/items/${itemId}/accounts`);
  }
}
