/**
 * Venmo pay links for a website checkout. No dependencies.
 *
 * Venmo has no API for a website to create or see a payment on a business
 * profile, so the checkout works by hand: the shopper is sent to Venmo with the
 * amount and a note filled in, and you confirm the money arrived. These helpers
 * build and validate the link.
 */

const USERNAME = /^[A-Za-z0-9_-]{3,30}$/;
const HOSTS = ["venmo.com", "www.venmo.com", "account.venmo.com"];
// First path segments on venmo.com that are pages, not usernames.
const RESERVED = ["code", "account", "business", "signin", "paymentlinks", "u"];

/**
 * A Venmo profile link from whatever the owner pastes: any https://venmo.com/...
 * address (a profile link, or the link behind their QR code) or an @username.
 * Returns null when it isn't one.
 */
export function venmoLink(raw) {
  const v = String(raw ?? "").trim();
  if (/^@[A-Za-z0-9_-]{3,30}$/.test(v)) return `https://venmo.com/u/${v.slice(1)}`;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || !HOSTS.includes(u.hostname) || u.username || u.password || u.port) return null;
    return u.toString().slice(0, 400);
  } catch {
    return null;
  }
}

/**
 * The username inside a pasted link or @name, or null. Profile links
 * (venmo.com/u/name or venmo.com/name) show it; the link behind a QR code
 * (venmo.com/code?user_id=...) does not. See `findUsername` for that case.
 */
export function venmoUsername(raw) {
  const v = String(raw ?? "").trim();
  if (v.startsWith("@")) return USERNAME.test(v.slice(1)) ? v.slice(1) : null;
  const link = venmoLink(v);
  if (!link) return null;
  const parts = new URL(link).pathname.split("/").filter(Boolean);
  const name = parts[0] === "u" ? parts[1] : parts.length === 1 && !RESERVED.includes(parts[0]) ? parts[0] : null;
  return name && USERNAME.test(name) ? name : null;
}

/**
 * A QR-code link (venmo.com/code?...) redirects to the profile page, so
 * following it reveals the username. Call this once when the owner saves their
 * settings, not on every order. Returns null if it can't be found.
 */
export async function findUsername(link, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(link, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (venmo-checkout)" } });
    return venmoUsername(res.url);
  } catch {
    return null;
  }
}

/**
 * The link that opens Venmo's pay screen with the amount and note filled in:
 *   https://venmo.com/<username>?txn=pay&amount=66.00&note=...
 * Venmo's website accepts this and keeps the amount and note, but Venmo doesn't
 * document it, so test it once from a phone (see docs/GUIDE.md). Returns null
 * when the username isn't valid; fall back to the plain profile link then.
 */
export function venmoPayLink(username, amountCents, note) {
  if (!USERNAME.test(String(username ?? ""))) return null;
  // venmo.com hands the link to the app as venmo://...?note=Hot+Pink, and the
  // app shows the "+" signs literally. A four-per-em space (U+2005) looks like
  // a space, still wraps, and comes through that hand-off intact.
  const q = new URLSearchParams({ txn: "pay", amount: (amountCents / 100).toFixed(2), note: String(note ?? "").replace(/ /g, " ") });
  // Encode any remaining spaces as %20, never "+".
  return `https://venmo.com/${username}?${q.toString().replace(/\+/g, "%20")}`;
}

/**
 * The note for an order: what was bought, then the order number LAST so you can
 * always match a payment to an order, e.g. "Canvas Tote (Navy) – Order 1031".
 * Trimmed to `max` characters, keeping the order number.
 *
 * items: [{ title, quantity, option? }]
 */
export function venmoNote(items, orderNumber, max = 180) {
  const tag = ` – Order ${orderNumber}`;
  const parts = (items ?? []).map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.title}${i.option ? ` (${i.option})` : ""}`);
  let text = parts.join(", ");
  if (!text) return `Order ${orderNumber}`;
  const room = max - tag.length;
  if (text.length > room) text = `${text.slice(0, room - 1).trimEnd()}…`;
  return text + tag;
}
