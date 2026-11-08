// A minimal working checkout page using only Node. Run: npm install && VENMO=@yourname npm run example
// Then open http://localhost:8080 . Orders live in memory; use your database in production.
import http from "node:http";
import { renderSVG } from "uqr";
import { createOrders } from "../src/orders.js";
import { memoryStore } from "../src/memory-store.js";
import { venmoLink, venmoUsername, findUsername } from "../src/venmo.js";

const raw = process.env.VENMO ?? "@example-shop";
const link = venmoLink(raw);
if (!link) throw new Error("Set VENMO to your profile link or @username");
const username = venmoUsername(link) ?? (await findUsername(link)) ?? "";
const settings = { name: process.env.SHOP_NAME ?? "Example Shop", link, username, holdHours: 48 };

const inventory = { tote: 5 };
const stock = {
  hold: async (items) => items.forEach((i) => { if ((inventory[i.sku] ?? 0) < i.quantity) throw new Error("Sold out"); inventory[i.sku] -= i.quantity; }),
  release: async (items) => items.forEach((i) => (inventory[i.sku] += i.quantity)),
};
const orders = createOrders({ store: memoryStore(), stock, settings });
setInterval(() => orders.sweep(), 5 * 60_000).unref();

const page = (body) => `<!doctype html><meta name=viewport content="width=device-width"><body style="font:16px system-ui;max-width:32rem;margin:2rem auto;padding:0 1rem">${body}`;
const send = (res, code, body, type = "text/html") => (res.writeHead(code, { "content-type": type }), res.end(body));

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, page(`<h1>Canvas Tote – $25.00</h1><form method=post action=/checkout><input name=email type=email placeholder=Email required> <button>Pay with Venmo</button></form><p>${inventory.tote} left</p>`));
    }
    if (req.method === "POST" && url.pathname === "/checkout") {
      let body = "";
      for await (const c of req) body += c;
      // Price comes from YOUR catalog, never from the browser.
      const o = await orders.start({ items: [{ sku: "tote", title: "Canvas Tote", quantity: 1 }], totalCents: 2500, email: new URLSearchParams(body).get("email") });
      res.writeHead(303, { location: `/thanks?order=${o.publicToken}` });
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/thanks") {
      const s = await orders.summary(url.searchParams.get("order"));
      if (!s) return send(res, 404, page("Order not found"));
      if (s.status !== "awaiting") return send(res, 200, page(`<h1>Order ${s.number}: ${s.status}</h1>`));
      const qr = renderSVG(s.link, { border: 2 });
      return send(res, 200, page(`
        <h1>Almost done: pay with Venmo</h1>
        <p>Send <b>$${(s.amountCents / 100).toFixed(2)}</b> on Venmo to <b>${s.name}</b>.</p>
        <p><a href="${s.link}" target=_blank rel="noopener noreferrer">Open Venmo to pay</a></p>
        <div style="width:200px">${qr}</div><small>On a computer? Scan with your phone's camera.</small>
        <p>${s.prefilled ? "The amount and note are filled in. Please leave the order number in the note." : `Put <b>Order ${s.number}</b> in the Venmo note.`}</p>
        <p><small>Held until ${new Date(s.holdUntil).toLocaleString()}. Venmo payments can't be cancelled once sent, so check the name and amount first.</small></p>`));
    }
    // Owner screen. PUT THIS BEHIND A LOGIN in a real site.
    if (req.method === "GET" && url.pathname === "/admin") {
      return send(res, 200, page("<h1>Admin</h1><p>POST /admin/paid?id=…&confirm=1 after you see the money in Venmo.</p>"));
    }
    if (req.method === "POST" && url.pathname === "/admin/paid") {
      const o = await orders.markPaid(url.searchParams.get("id"), { confirm: url.searchParams.get("confirm") === "1" });
      return send(res, 200, JSON.stringify(o), "application/json");
    }
    send(res, 404, "Not found", "text/plain");
  } catch (e) {
    send(res, 400, page(`<p>${String(e.message).replace(/</g, "&lt;")}</p>`));
  }
}).listen(8080, () => console.log("http://localhost:8080  (pay link username:", username || "unknown, profile link only", ")"));
