export interface CouponContext {
  readonly itemTotal: number;
  readonly itemCount: number;
  readonly usedCouponCodes: readonly string[];
}

export type CouponEvaluationResult =
  | { readonly valid: true; readonly discount: number; readonly waiveDelivery: boolean }
  | { readonly valid: false; readonly reason: string };

export interface CouponRule {
  readonly code: string;
  readonly description: string;
  readonly oneTime?: boolean;
  evaluate(context: CouponContext): CouponEvaluationResult;
}

const discount = (amount: number): CouponEvaluationResult =>
  ({ valid: true, discount: amount, waiveDelivery: false });

export const couponRules: readonly CouponRule[] = [
  {
    code: 'FLAT50',
    description: '₹50 off on items worth ₹300 or more',
    evaluate: ({ itemTotal }) => itemTotal >= 300
      ? discount(50)
      : { valid: false, reason: 'FLAT50 requires an item total of at least ₹300.' },
  },
  {
    code: 'SAVE10',
    description: '10% off your items, up to ₹100',
    evaluate: ({ itemTotal }) => discount(Math.min(100, Math.round(itemTotal * 0.1))),
  },
  {
    code: 'FREEDEL',
    description: 'Free delivery on any order',
    evaluate: () => ({ valid: true, discount: 0, waiveDelivery: true }),
  },
  {
    code: 'FIRST100',
    description: '₹100 off on items worth ₹200 or more · once per installation',
    oneTime: true,
    evaluate: ({ itemTotal }) => itemTotal >= 200
      ? discount(100)
      : { valid: false, reason: 'FIRST100 requires an item total of at least ₹200.' },
  },
];

export const normalizeCouponCode = (code: string): string => code.trim().toUpperCase();

export function evaluateCoupon(
  input: string,
  context: CouponContext,
  registry: readonly CouponRule[] = couponRules,
): CouponEvaluationResult {
  const code = normalizeCouponCode(input);
  const rule = registry.find((candidate) => candidate.code === code);
  if (!rule) return { valid: false, reason: 'That coupon code is not valid. Please try another.' };
  if (context.itemCount === 0) return { valid: false, reason: 'Add a medicine before applying a coupon.' };
  if (rule.oneTime && context.usedCouponCodes.includes(code)) {
    return { valid: false, reason: `${code} has already been redeemed on this device.` };
  }
  const result = rule.evaluate(context);
  return result.valid
    ? { ...result, discount: Math.max(0, Math.min(context.itemTotal, result.discount)) }
    : result;
}

export function redeemCoupon(code: string | null, usedCodes: readonly string[]): readonly string[] {
  if (!code || !couponRules.some((rule) => rule.code === code && rule.oneTime)) return usedCodes;
  return usedCodes.includes(code) ? usedCodes : [...usedCodes, code];
}
