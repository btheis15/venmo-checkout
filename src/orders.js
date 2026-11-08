/**
 * The order rules for a payment you confirm by hand (Venmo, Zelle, cash...).
 * Storage-agnostic: pass a store with get/put/list (see memory-store.js).
 *
 *   start()    -> order is "awaiting"; the pieces are held until `holdUntil`
 *   markPaid() -> you saw the money arrive; order becomes "paid"
 *   cancel()   -> put the pieces back; order becomes "expired"
 *   sweep()    -> run every few minutes: expires orders whose hold ran out
 *
 * `stock` is your own inventory: { hold(items), release(items) }. Both must be
 * safe to call once per order (the engine only calls each once).
 */
import { randomUUID } from "node:crypto";
import { venmoNote, venmoPayLink } from "./venmo.js";

export function createOrders({ store, stock, settings, now = () => Date.now() }) {
  // settings: { username, link, name, holdHours }
  const payLink = (o) => venmoPayLink(settings.username, o.totalCents, venmoNote(o.items, o.number)) ?? settings.link;

  async function start({ items, totalCents, email }) {
    const number = await store.nextNumber();
    const order = {
      id: randomUUID(),
      // A secret the thank-you page uses to find the order. Never use the order number for that.
      publicToken: randomUUID(),
      number,
      items,
      totalCents,
      email,
      status: "awaiting",
      holdUntil: new Date(now() + (settings.holdHours ?? 48) * 3600_000).toISOString(),
      stockHeld: false,
    };
    // Hold first: if there isn't enough stock this throws and no order exists.
    await stock.hold(items);
    order.stockHeld = true;
    await store.put(order);
    return order;
  }

  /** What the thank-you page shows. `qrSvg` is filled by the caller (see examples/server.mjs). */
  async function summary(publicToken) {
    const o = await store.byToken(publicToken);
    if (!o) return null;
    return {
      number: o.number,
      status: o.status,
      name: settings.name,
      amountCents: o.totalCents,
      note: venmoNote(o.items, o.number),
      link: payLink(o),
      prefilled: Boolean(venmoPayLink(settings.username, o.totalCents, "x")),
      holdUntil: o.holdUntil,
    };
  }

  /** `confirm` must be true: it is a deliberate click after you checked the amount in Venmo. */
  async function markPaid(id, { confirm = false } = {}) {
    const o = await store.get(id);
    if (!o || !["awaiting", "expired"].includes(o.status)) throw new Error("not waiting for payment");
    if (!confirm) throw new Error("confirm that the payment arrived");
    // Late payment: the hold ran out and the pieces were released. Take them again.
    if (!o.stockHeld) {
      await stock.hold(o.items);
      o.stockHeld = true;
      o.lateNote = "Paid after the hold ran out: check the pieces were still in stock.";
    }
    o.status = "paid";
    o.paidAt = new Date(now()).toISOString();
    await store.put(o);
    return o;
  }

  async function cancel(id, reason = "cancelled") {
    const o = await store.get(id);
    if (!o || o.status !== "awaiting") throw new Error("only an unpaid order can be cancelled");
    o.status = "expired";
    o.reason = reason;
    if (o.stockHeld) {
      await stock.release(o.items);
      o.stockHeld = false;
    }
    await store.put(o);
    return o;
  }

  async function sweep() {
    const out = [];
    for (const o of await store.list()) {
      if (o.status === "awaiting" && Date.parse(o.holdUntil) <= now()) out.push(await cancel(o.id, "timeout"));
    }
    return out;
  }

  return { start, summary, markPaid, cancel, sweep, payLink };
}
