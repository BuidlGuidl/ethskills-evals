import { base, baseSepolia } from "viem/chains";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var ${name}`);
  return v;
}

export const config = {
  chain: process.env.CHAIN === "base-sepolia" ? baseSepolia : base,
  rpcUrl: required("RPC_URL"),
  billingAddress: required("BILLING_ADDRESS") as `0x${string}`,
  /**
   * Block the contract was deployed in. The keeper scans from here to find
   * subscribers; without it every run would rescan the whole chain.
   */
  deployBlock: BigInt(process.env.DEPLOY_BLOCK ?? "0"),
  /**
   * How long a positive auth decision may be cached. The contract tells us the
   * exact expiry, but `cancel` and `withdraw` can pull it in early, so we also
   * cap it. 60s means a cancelled customer keeps access for at most a minute.
   */
  maxCacheSeconds: Number(process.env.MAX_CACHE_SECONDS ?? "60"),
  /** Domain bound into the login message so a signature cannot be replayed elsewhere. */
  authDomain: process.env.AUTH_DOMAIN ?? "weather-api.example",
  port: Number(process.env.PORT ?? "8080"),
};
