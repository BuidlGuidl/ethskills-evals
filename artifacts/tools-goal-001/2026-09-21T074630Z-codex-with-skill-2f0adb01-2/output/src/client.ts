import type { Network } from "@x402/core/types";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig, type SelectPaymentRequirements } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { env, requirePrivateKey } from "./config.js";
import { normalizeWalletAddress } from "./activity.js";

const address = normalizeWalletAddress(process.argv[2]);
const privateKey = requirePrivateKey(env.AGENT_PRIVATE_KEY, "AGENT_PRIVATE_KEY");
const account = privateKeyToAccount(privateKey);
const maxBaseUnits = BigInt(Math.floor(env.MAX_USD_PER_CALL * 1_000_000));
const paymentNetwork = env.X402_NETWORK as Network;

const selectAffordableBasePayment: SelectPaymentRequirements = (_version, accepts) => {
  const selected =
    accepts.find(requirement => requirement.network === paymentNetwork && requirement.scheme === "exact") ??
    accepts[0];

  if (!selected) {
    throw new Error("Server did not advertise any x402 payment requirements");
  }

  const requiredAmount = BigInt(selected.amount);
  if (requiredAmount > maxBaseUnits) {
    throw new Error(
      `Refusing to pay ${selected.amount} base units; MAX_USD_PER_CALL allows ${maxBaseUnits.toString()}`,
    );
  }

  return selected;
};

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: paymentNetwork,
      client: new ExactEvmScheme(account, { rpcUrl: env.BASE_RPC_URL }),
    },
  ],
  paymentRequirementsSelector: selectAffordableBasePayment,
});

const url = new URL(env.API_URL);
url.searchParams.set("address", address);

const response = await fetchWithPayment(url, {
  headers: {
    accept: "application/json",
  },
});

const body = await response.json();
const paymentResponse = response.headers.get("PAYMENT-RESPONSE");

if (!response.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(body, null, 2));
}

if (paymentResponse) {
  console.log("\nPayment receipt:");
  console.log(JSON.stringify(decodePaymentResponseHeader(paymentResponse), null, 2));
}
