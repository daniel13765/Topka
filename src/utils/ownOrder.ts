import { ordersApi } from '../services/api';

/**
 * Anti-IDOR : une commande n'est considérée visible que si elle figure dans
 * MES commandes — `GET /orders` (OrderController@index) est filtré côté serveur
 * par `user_id = auth()->id()`. Scan paginé borné à 20 pages (300 commandes) ;
 * au-delà, on refuse par prudence.
 */
export async function isOwnOrder(id: number): Promise<boolean> {
  let page = 1;
  let last = 1;
  do {
    const res = await ordersApi.getOrders(page);
    const raw = (res?.data ?? res ?? []) as Array<Record<string, unknown> & { data?: { id?: number } }>;
    const list = (Array.isArray(raw) ? raw : []).map((o) => (o.data ?? o) as { id?: number });
    if (list.some((o) => Number(o.id) === Number(id))) return true;
    last = Number(res?.meta?.last_page ?? res?.last_page ?? 1);
    page += 1;
  } while (page <= last && page <= 20);
  return false;
}
