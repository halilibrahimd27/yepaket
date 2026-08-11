import { camelToSnake, deepSnakeCase } from './case';

describe('camelToSnake', () => {
  it.each([
    ['amountMinor', 'amount_minor'],
    ['availableQuantity', 'available_quantity'],
    ['id', 'id'],
    ['orderNo', 'order_no'],
    ['pickupStartsAt', 'pickup_starts_at'],
    ['already_snake', 'already_snake'],
  ])('%s -> %s', (input, expected) => {
    expect(camelToSnake(input)).toBe(expected);
  });

  it('ardışık büyük harfleri tek parça sayar', () => {
    // "orderID" -> "order_id" olmalı, "order_i_d" değil.
    expect(camelToSnake('orderID')).toBe('order_id');
    expect(camelToSnake('userIDList')).toBe('user_id_list');
  });
});

describe('deepSnakeCase', () => {
  it('iç içe nesne ve dizilerde anahtarları çevirir', () => {
    const input = {
      orderNo: 'YP-1048',
      pickupWindow: { startsAt: 'x', endsAt: 'y' },
      items: [{ bagId: '1', unitPriceMinor: 13900 }],
    };

    expect(deepSnakeCase(input)).toEqual({
      order_no: 'YP-1048',
      pickup_window: { starts_at: 'x', ends_at: 'y' },
      items: [{ bag_id: '1', unit_price_minor: 13900 }],
    });
  });

  it('Date değerini ISO dizgiye çevirir', () => {
    const date = new Date('2026-08-10T17:00:00.000Z');
    expect(deepSnakeCase({ createdAt: date })).toEqual({
      created_at: '2026-08-10T17:00:00.000Z',
    });
  });

  it('BigInt değerini dizgiye çevirir — JSON BigInt taşıyamaz', () => {
    expect(deepSnakeCase({ netMinor: 3874000n })).toEqual({ net_minor: '3874000' });
  });

  it('serbest JSON alanlarının içeriğine dokunmaz', () => {
    // Bildirim `data` yükü istemcinin beklediği anahtarları taşır;
    // dönüştürülürse derin bağlantı bozulur.
    const input = { notificationType: 'ORDER_STATUS', data: { orderId: 'abc', deepLink: '/x' } };

    expect(deepSnakeCase(input)).toEqual({
      notification_type: 'ORDER_STATUS',
      data: { orderId: 'abc', deepLink: '/x' },
    });
  });

  it('null ve undefined değerleri korur', () => {
    expect(deepSnakeCase({ avatarUrl: null, deletedAt: undefined })).toEqual({
      avatar_url: null,
      deleted_at: undefined,
    });
  });
});
