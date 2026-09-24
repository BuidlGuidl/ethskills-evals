/**
 * The exact string a member signs to authorise a write. Lives in its own
 * module so the browser can build it without pulling in the server's database
 * driver, and so the two sides can never drift apart.
 */
export function authMessage(action: string, address: string, nonce: string, issuedAt: number): string {
  return [
    "Toolshed",
    `Action: ${action}`,
    `Address: ${address.toLowerCase()}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
