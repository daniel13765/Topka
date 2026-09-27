import { describe, expect, it } from 'vitest';
import { describeNotification } from '../src/utils/notificationText';

describe('notification descriptions', () => {
  it('describes order status notifications in French', () => {
    const result = describeNotification({ type: 'order.status', data: { order_id: 12, statut: 'livre' } } as any, true);
    expect(result.title).toContain('#12');
    expect(result.message).toContain('livrée');
    expect(result.orderId).toBe(12);
  });
  it('links accepted negotiations to their order', () => expect(describeNotification({ type: 'budget.response', data: { order_id: 8, statut: 'accepte' } } as any, true).orderId).toBe(8));
  it('has a safe fallback for unknown types', () => expect(describeNotification({ type: 'unknown', data: {} } as any, true).title).toContain('TOKPa'));
});
