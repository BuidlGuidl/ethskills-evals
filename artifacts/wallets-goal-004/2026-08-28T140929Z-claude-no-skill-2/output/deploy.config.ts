/**
 * What to deploy. Edit this, not deploy.ts.
 */
export const deployConfig = {
  /** Contract name as written in the .sol file (must match, case-sensitive). */
  contract: "Greeter",

  /** Constructor arguments, in order. Use [] for a contract with no constructor args. */
  args: ["gm from Sepolia"] as unknown[],
};
