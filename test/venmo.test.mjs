import test from "node:test";
import assert from "node:assert/strict";
import { venmoLink, venmoUsername, venmoPayLink, venmoNote, findUsername } from "../src/venmo.js";
import { createOrders } from "../src/orders.js";
import { memoryStore } from "../src/memory-store.js";

test("links and usernames", () => {
  assert.equal(venmoLink("@shop-name"), "https://venmo.com/u/shop-name");
  assert.equal(venmoLink("http://venmo.com/x"), null);
  assert.equal(venmoLink("https://evil.com/venmo.com"), null);
  assert.equal(venmoLink("https://user:pw@venmo.com/shop"), null);
  assert.equal(venmoUsername("@shop-name"), "shop-name");
  assert.equal(venmoUsername("https://venmo.com/u/shopname"), "shopname");
  assert.equal(venmoUsername("https://venmo.com/shopname"), "shopname");
  assert.equal(venmoUsername("https://venmo.com/code?user_id=123&created=1&printed=1"), null);
});

test("QR-code link: username found by following the redirect", async () => {
  const fake = async () => ({ url: "https://venmo.com/u/shopname" });
  assert.equal(await findUsername("https://venmo.com/code?user_id=1", fake), "shopname");
  assert.equal(await findUsername("https://venmo.com/code?user_id=1", async () => { throw new Error("offline"); }), null);
});

test("pay link carries amount and note, spaces survive the app hand-off", () => {
  const url = new URL(venmoPayLink("shopname", 6600, "Hot Pink – Order 1042"));
  assert.equal(url.searchParams.get("txn"), "pay");
  assert.equal(url.searchParams.get("amount"), "66.00");
  assert.ok(!url.search.includes("+"), "no + signs");
  assert.ok(!url.search.includes(" "));
  assert.equal(url.searchParams.get("note"), "Hot Pink – Order 1042");
  assert.equal(venmoPayLink("no", 100, "x"), null);
});

test("note: items, then the order number last, trimmed to fit", () => {
  assert.equal(venmoNote([{ title: "Tote", quantity: 1, option: "Navy" }], 1031), "Tote (Navy) – Order 1031");
  assert.equal(venmoNote([{ title: "Mug", quantity: 2 }], 7), "2× Mug – Order 7");
  assert.equal(venmoNote([], 7), "Order 7");
  const long = venmoNote([{ title: "x".repeat(400), quantity: 1 }], 1031, 60);
  assert.ok(long.length <= 60 && long.endsWith("– Order 1031") && long.includes("…"));
});

function shop() {
  let t = Date.parse("2026-01-01T00:00:00Z");
  const held = [];
  const stock = { hold: async (i) => held.push(["hold", i]), release: async (i) => held.push(["release", i]) };
  const orders = createOrders({ store: memoryStore(), stock, settings: { username: "shopname", link: "https://venmo.com/shopname", name: "Shop", holdHours: 48 }, now: () => t });
  return { orders, held, advance: (h) => (t += h * 3600_000) };
}

test("hold, pay, and the hold running out", async () => {
  const { orders, held, advance } = shop();
  const o = await orders.start({ items: [{ title: "Tote", quantity: 1 }], totalCents: 2500, email: "a@b.c" });
  assert.equal(o.status, "awaiting");
  assert.equal((await orders.summary(o.publicToken)).amountCents, 2500);
  await assert.rejects(() => orders.markPaid(o.id), /confirm/);
  assert.equal((await orders.markPaid(o.id, { confirm: true })).status, "paid");

  const o2 = await orders.start({ items: [{ title: "Mug", quantity: 1 }], totalCents: 900, email: "a@b.c" });
  advance(49);
  assert.equal((await orders.sweep()).length, 1);
  assert.deepEqual(held.at(-1)[0], "release");
  // Money turns up late: allowed, takes the stock again and says so.
  const late = await orders.markPaid(o2.id, { confirm: true });
  assert.equal(late.status, "paid");
  assert.ok(late.lateNote);
  assert.equal(held.at(-1)[0], "hold");
});

test("no stock, no order", async () => {
  const orders = createOrders({ store: memoryStore(), stock: { hold: async () => { throw new Error("sold out"); }, release: async () => {} }, settings: { username: "x_y", holdHours: 1 } });
  await assert.rejects(() => orders.start({ items: [], totalCents: 100 }), /sold out/);
});
