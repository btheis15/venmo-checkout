# Adding Venmo checkout to a website

These steps are written to work on any stack. The code in `src/` is plain JavaScript; port the ideas if you use another language.

## How it works, and what it can't do

Venmo gives a **business profile** no API a website can use to create a charge or to find out a payment arrived. (PayPal's checkout can show a "Venmo" button through PayPal's own API, which is a different route: see [the alternative](#alternative-paypals-venmo-button) at the end.) So the shopper pays from their own Venmo app and **you confirm by hand**, exactly like Zelle.

What you build is small:

1. A way to pay called "venmo" at checkout.
2. A saved order in an **awaiting** state that **holds the stock**.
3. A thank-you page with a pay button, a QR code and plain instructions.
4. An owner screen with **Mark paid** and **Cancel**.
5. A timer that cancels orders nobody paid and gives the stock back.
6. Two emails: instructions to the shopper, "waiting for payment" to you (optional but useful).

## 1. Settings you need to store

| Setting | Notes |
|---|---|
| `enabled` | A switch, off by default. |
| `name` | The name shoppers will see on Venmo (your business profile name). |
| `link` | Your profile link, the link behind your Venmo QR code, or an `@username`. Validate with `venmoLink()`. |
| `username` | Found from `link` for you (see step 2). Needed to pre-fill the amount. |
| `holdHours` | How long to hold the stock. Default 48, allow 12 to 168. |

Keep these in your own settings or database, **not in a public repo or the public feed**. The browser only needs the name, the link, and the hold time.

## 2. Find the username

The pre-filled pay link needs the username: `https://venmo.com/<username>?txn=pay&amount=…&note=…`.

- A profile link (`venmo.com/u/name` or `venmo.com/name`) or `@name` contains it: `venmoUsername()`.
- The link behind a **QR code** (`venmo.com/code?user_id=…`) does not, but that page redirects to the profile, so following it reveals the username: `findUsername()`. Do this **once, when the owner saves settings**, and store the result. If it fails, ask the owner to type the username; the site still works by sending shoppers to the profile and asking them to type the amount.

Never accept a link on any host other than `venmo.com`. `venmoLink()` rejects other hosts, `http:`, embedded credentials and ports.

## 3. Start the order (server side)

When the shopper picks Venmo:

1. **Re-price the cart on the server** from your own catalog. Never trust an amount, price or stock count sent by the browser.
2. **Hold the stock first.** If it isn't there, fail before anything is saved.
3. Save the order: items, total, email, address, `status = awaiting`, `holdUntil = now + holdHours`, a sequential **order number**, and a separate random **public token**.
4. Send the shopper to the thank-you page with the **public token** in the URL (`/thanks?order=<token>`), not the order number. Numbers are guessable, and the page shows the shopper's details.
5. Clear the cart now. The money is the shopper's next step, not yours.

`createOrders({ store, stock, settings }).start()` in `src/orders.js` does 2 and 3.

## 4. The thank-you page

Show, in this order:

1. **"Send $66.00 on Venmo to Shop Name."**
2. A big **Open Venmo to pay** button linking to the pay link (open in a new tab, `rel="noopener noreferrer"`).
3. A **QR code** of the same link, for shoppers on a computer ("On a computer? Scan this with your phone's camera"). Generate it on the server (the example uses [`uqr`](https://github.com/unjs/uqr), any QR library works).
4. One sentence: *"The amount and your order number are filled in for you. Please leave the number in the Venmo note so we can match it to your order."* If you couldn't find the username, say *"Put Order 1031 in the Venmo note"* instead.
5. Small print: *"We're holding your order until <date, time and timezone>. It ships as soon as the payment arrives. Venmo payments can't be cancelled once sent, so please check the name and amount first."*

Hide any generic "we're confirming your payment" text on this page; it contradicts the instructions. Use your **shop's** timezone when you print the hold time, not the server's.

## 5. The note

`venmoNote(items, orderNumber)` gives `Canvas Tote (Navy) – Order 1031`, or `2× Mug, Canvas Tote (Navy) – Order 1031`.

- It names what was bought, which is friendlier on the shopper's Venmo feed than a bare number.
- **The order number is always last** and survives trimming (180 characters), because it is how you match a payment to an order.

### The "+" bug (important)

`venmo.com` redirects your link to the app as `venmo://paycharge?...&note=Hot+Pink`, and the app shows the `+` **literally**. `%20` doesn't help: it is re-encoded as `+` on the way. What does work is sending each space in the note as **U+2005** (a four-per-em space). It looks like a space, wraps like one, and comes through the hand-off intact. `venmoPayLink()` does this. If you build the link yourself, keep it.

## 6. Test the link on a phone

Venmo's website accepts `?txn=pay&amount=&note=` and keeps both, but **Venmo doesn't document it**, and a similar pre-filled link format stopped working in 2024 per user reports. So test it before you rely on it, and re-test now and then:

1. Open `https://venmo.com/<your-username>?txn=pay&amount=1.00&note=test` on a phone with Venmo installed.
2. You should land on the pay screen with **$1.00** and the note filled in. **Don't press Pay.**
3. Also open the page's QR code with the phone camera and check it does the same.

If Venmo ever stops honoring it, nothing breaks badly: set `username` to empty and the site falls back to your plain profile link plus "put the order number in the note".

## 7. Mark paid, cancel, and the hold

Give the owner (behind a login) a list of Venmo orders with **Mark paid** and **Cancel order**.

- **Mark paid** needs a deliberate confirmation ("I saw $66.00 arrive in my Venmo activity"). **Check the amount in Venmo first.** The shopper can edit the amount on Venmo's screen, and Venmo can't tell your site.
- A payment can arrive **after the hold ran out** (the order was cancelled and the stock returned). Allow Mark paid on an expired order: take the stock again and **flag it for the owner** to check it was still available (`lateNote`).
- **Cancel** puts the pieces back and emails the shopper.
- Run `sweep()` every few minutes (cron, a timer, a scheduled function) to cancel orders whose hold ran out.
- Show a "waiting for payment" count so the owner notices orders that need attention.

## 8. Refunds

Venmo refunds are sent from Venmo (the app or website), not from your site. Record them on the order by hand so your books and stock stay right.

## 9. Emails (optional)

- **To the shopper**, right after the order: the same instructions as the thank-you page (amount, the pay link, the note, the hold deadline). Subject like "Pay with Venmo to complete order 1031".
- **To you**: "Order 1031 is waiting for a Venmo payment."
- **To the shopper**, when cancelled for no payment: the pieces were released, here's how to order again.

## 10. In person (optional)

If you also sell face to face, show a QR for exactly what is owed (after any price you agree first). The customer scans it with their camera or Venmo and pays by balance, bank or card as they like. Tap **I got the Venmo payment** once it shows in your activity. If you have staff accounts, flag a staff member's tap for the owner to check, because it can't be verified automatically.

## 11. Database notes

If your `orders` table limits the payment type with a `CHECK (provider IN (...))`, adding `'venmo'` means **rebuilding the table** in SQLite (it can't alter a CHECK). Do it in a migration that creates `orders_new`, copies rows, drops the old table and renames, with foreign keys off, and **try it on a copy of your real database first**. Postgres and MySQL can alter the constraint directly.

Minimum columns: `id`, `number` (unique, sequential), `public_token` (unique, random), `provider`, `payment_status` (awaiting / paid / expired / refunded), `total_cents`, `customer_email`, `ship_to`, `expires_at`, `paid_at`, `stock_held`.

## 12. Fees, rules and wording

- Selling goods needs a **business profile**. A personal profile can only take sales if the buyer marks the payment as a purchase (which carries a seller fee). Check Venmo's **current** terms and fees before you decide; they change. The fee is Venmo's and is not added to the price here.
- If you charge sales tax or shipping, add them to the total on your side before you build the link. Some places restrict surcharges for particular payment types, so don't add a Venmo-only fee without checking local rules.
- Say clearly that Venmo payments can't be cancelled once sent, and that you hold the order for N hours.

## Checklist

- [ ] Settings saved, username found (or typed)
- [ ] Server re-prices the cart; stock held before the order is saved
- [ ] Public token (not the order number) in the thank-you URL
- [ ] Thank-you page: amount, button, QR, note sentence, hold deadline in your timezone
- [ ] Note ends with the order number; spaces sent as U+2005
- [ ] Tested the link on a real phone with `amount=1.00`
- [ ] Owner screen: Mark paid (with confirm), Cancel; late payments flagged
- [ ] `sweep()` scheduled
- [ ] Refunds recorded by hand
- [ ] Emails (optional)

## Alternative: PayPal's Venmo button

If you'd rather have **automatic** confirmation, PayPal's JavaScript SDK can show a Venmo button for US shoppers on a PayPal Business account (USD only). Your server creates the order with PayPal's Orders API and captures it on approval, and PayPal's webhooks confirm it. That needs a PayPal Business account and the PayPal SDK, and it is a different integration from this one (this kit is for a Venmo **business profile** paid directly).
