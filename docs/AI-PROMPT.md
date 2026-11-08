# Prompt for an AI coding assistant

Copy everything in the box into Claude Code, Cursor or another assistant, with your site's repository open. Fill in the two blanks first.

```text
Add Venmo as a way to pay at checkout on this website, using the instructions and
code in https://github.com/btheis15/venmo-checkout (read docs/GUIDE.md first, then
src/venmo.js and src/orders.js; copy them into this project in our own style and
language rather than adding the repo as a dependency).

My Venmo business profile link or @username: <PASTE HERE, or say "I'll add it in settings">
How long to hold the order for payment: <e.g. 48 hours>

Requirements:
- Venmo is paid by hand, with no API: the order is saved as "awaiting" and the
  stock is held; the owner marks it paid after seeing the money in Venmo.
- Re-price the cart on the server. Never trust amounts from the browser.
- Thank-you page URL uses a random public token, not the order number.
- Thank-you page: amount, "Open Venmo to pay" button, QR code, the note sentence,
  and the hold deadline in the shop's timezone. Clear the cart.
- Pay link: https://venmo.com/<username>?txn=pay&amount=<dollars>&note=<note>.
  The note is what was bought, then "– Order <number>" last. Send spaces in the
  note as U+2005 (not "+", not %20) because the Venmo app shows "+" literally.
- Settings: enabled, shop name, profile link, username (found from the link; if
  the link is a Venmo QR "code" link, follow its redirect once on save), hold hours.
  Store them privately. Only accept https://venmo.com links.
- Owner screen: Mark paid (requires a confirmation and a reminder to check the
  amount in Venmo) and Cancel (releases stock, emails the shopper). A late payment
  on an expired order may be marked paid: re-take the stock and flag it.
- Schedule a sweep every few minutes that cancels orders whose hold ran out.
- If the orders table has a CHECK on the payment type, add a migration that
  rebuilds it, and test the migration on a copy of the real database.
- Add tests for the link, the note, the hold/expire/late-payment rules.

Then run the tests, open the thank-you page, and show me the pay link. Do not
commit my Venmo link or any keys to a public repository. Tell me to test the link
on my phone with amount=1.00 before going live (do not press Pay).
```
