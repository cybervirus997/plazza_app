import { createCheckoutReview } from '../src/domain/checkoutReview';
import { parsePaymentAttempt, type PaymentScenario } from '../src/domain/payments';
import { adaptMedicine } from '../src/features/catalog/products';
import { createOrderingService, type StartPaymentInput } from '../src/features/orders/ordering';
import { STORAGE_KEY } from '../src/storage/persistence';
import { ADDRESS_STORAGE_KEY } from '../src/repositories/local/LocalAddressRepository';
import { orderInput, orderStorage } from './order-fixtures';

export function paymentSetup(scenario: PaymentScenario = 'success') {
  const memory = orderStorage();
  const input = orderInput();
  if (!input.deliveryAddress) throw new Error('Missing fixture address');
  const address = input.deliveryAddress.address;
  memory.data.set(ADDRESS_STORAGE_KEY, JSON.stringify({ version: 1, addresses: [address], defaultAddressId: address.id, selectedAddressId: address.id }));
  const products = input.products.map(adaptMedicine);
  const snapshot = { cart: input.cart, activeCouponCode: input.couponCode, usedCouponCodes: [], recentSearches: ['care'] };
  memory.data.set(STORAGE_KEY, JSON.stringify({ version: 1, ...snapshot }));
  const review = createCheckoutReview({ snapshot, products, address: input.deliveryAddress, deliveryPreference: 'asap' });
  let count = 0;
  const identity = jest.fn(() => { count += 1; return { id: `payment-${count}`, orderId: `order-${count}`, checkoutId: `checkout-${count}`, placedAt: input.placedAt }; });
  const now = () => '2026-10-29T09:01:00.000Z';
  const options = { identity, now };
  const service = createOrderingService(memory.port, options);
  const start: StartPaymentInput = { review, snapshot, products, address: jest.fn(async () => input.deliveryAddress),
    isReviewCurrent: () => true, method: 'upi', scenario };
  return { ...memory, input, options, service, start };
}
export function paymentAttempt() {
  const app = paymentSetup();
  return parsePaymentAttempt({ version: 1, id: 'payment-1', order: { ...app.start.review, id: 'order-1', checkoutId: 'checkout-1', placedAt: app.input.placedAt },
    method: 'upi', scenario: 'success', status: 'initiated', updatedAt: app.input.placedAt, finalized: false });
}
