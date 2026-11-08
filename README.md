# venmo-checkout

Add **Venmo** as a way to pay on your own website, with no payment company in the middle.

Venmo has no way for a website to create or see a payment on a business profile. So this works by hand, the way Zelle does:

1. The shopper picks Venmo at checkout. Your site **saves the order and holds the stock**.
2. The thank-you page shows an **Open Venmo to pay** button and a **QR code**. Both open Venmo's pay screen with the **amount and a note already filled in** (what they bought, plus the order number).
3. You see the money arrive in Venmo and press **Mark paid**. The order ships. If nobody pays before the hold runs out, the order is cancelled and the stock goes back.

```
shopper picks Venmo ─▶ start(): order saved, stock held, "awaiting"
thank-you page      ─▶ button + QR  =  https://venmo.com/<you>?txn=pay&amount=25.00&note=Tote – Order 1031
shopper pays in Venmo
you check Venmo     ─▶ markPaid(id, {confirm:true})   (or the hold runs out → sweep() cancels, stock returns)
```

## What's here

| Path | What it is |
|---|---|
| [`docs/GUIDE.md`](docs/GUIDE.md) | **Start here.** Step-by-step instructions for adding this to any site, plus every gotcha we hit. |
| [`docs/AI-PROMPT.md`](docs/AI-PROMPT.md) | A prompt to paste into an AI coding assistant (Claude Code, Cursor, …) so it adds Venmo checkout to your repo. |
| [`src/venmo.js`](src/venmo.js) | Pay-link, username and note helpers. No dependencies. Copy this file even if you copy nothing else. |
| [`src/orders.js`](src/orders.js) | The hold / mark paid / cancel / expire rules, storage-agnostic. |
| [`src/memory-store.js`](src/memory-store.js) | An in-memory store for trying it out. |
| [`examples/server.mjs`](examples/server.mjs) | A complete tiny checkout in plain Node (thank-you page with button and QR). |
| [`test/`](test) | Tests for the links, the note and the order rules. |

## Try it

Needs Node 20+.

```sh
npm install
npm test
VENMO=@your-username npm run example
# open http://localhost:8080, pick Venmo, and look at the thank-you page
```

## Before you go live

- You need a **Venmo business profile** to sell goods. Venmo's rules and fees change; read their current business-profile terms.
- The pre-filled link format is **not documented by Venmo**. Test it once from your own phone ([guide, step 6](docs/GUIDE.md#6-test-the-link-on-a-phone)).
- Because a shopper can change the amount in Venmo, **always check the amount in your Venmo activity before pressing Mark paid.**

This is not affiliated with or endorsed by Venmo or PayPal. MIT licensed.
