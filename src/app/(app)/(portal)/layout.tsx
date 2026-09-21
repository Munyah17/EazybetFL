/**
 * Client console scope -- wraps the logged-in customer's portal pages
 * (account, wallet, bets, booked-bets) in the `portal` class so they pick up
 * the CoolAdmin token overrides from globals.css.
 *
 * `contents` keeps the wrapper out of the box tree entirely: it exists only
 * to scope CSS variable inheritance, so page layout is byte-for-byte
 * identical to before. Route groups don't affect URLs -- /account, /wallet,
 * /bets and /booked-bets are unchanged.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="portal contents">{children}</div>;
}
