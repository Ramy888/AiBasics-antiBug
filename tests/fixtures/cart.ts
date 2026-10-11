export type Item = { sku: string; price: number; qty: number };

export const FREE_SHIPPING_MIN = 50;

export function subtotal(items: Item[]): number {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].qty;
  }
  return total;
}

export function shipping(items: Item[]): number {
  // Orders at or above the minimum ship free.
  return subtotal(items) >= FREE_SHIPPING_MIN ? 0 : 5;
}

export function applyDiscount(total: number, percent = 0): number {
  if (percent <= 0 || percent > 100) return total;
  return Math.round(total * (100 - percent)) / 100;
}

export async function checkout(items: Item[], pay: (amount: number) => Promise<boolean>) {
  if (items.length === 0) throw new Error("empty cart");
  const amount = applyDiscount(subtotal(items) + shipping(items));
  const ok = await pay(amount);
  return { ok, amount };
}
