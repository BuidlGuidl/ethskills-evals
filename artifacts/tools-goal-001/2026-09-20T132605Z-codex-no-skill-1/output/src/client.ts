import "dotenv/config";

import {
  decodePaymentResponseHeader,
  wrapFetchWithPaymentFromConfig,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { Network } from "@x402/core/types";
import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const TARGET_WALLET = process.argv[2] ?? process.env.TARGET_WALLET;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const X402_NETWORK = process.env.X402_NETWORK ?? "eip155:8453";
const MAX_PAYMENT_USD = process.env.MAX_PAYMENT_USD ?? "$0.10";
const TRUSTED_PAY_TO_ADDRESS = process.env.TRUSTED_PAY_TO_ADDRESS;

if (!TARGET_WALLET || !isAddress(TARGET_WALLET)) {
  throw new Error("Set TARGET_WALLET or pass a wallet address as the first argument.");
}

if (!AGENT_PRIVATE_KEY?.startsWith("0x")) {
  throw new Error("Set AGENT_PRIVATE_KEY to the paying agent wallet private key.");
}

function requireNetwork(value: string): Network {
  if (!/^[a-z0-9-]+:[a-zA-Z0-9-]+$/.test(value)) {
    throw new Error(`X402_NETWORK must be a CAIP-2 network id, got "${value}".`);
  }

  return value as Network;
}

const network = requireNetwork(X402_NETWORK);
const trustedPayTo = TRUSTED_PAY_TO_ADDRESS
  ? getAddress(TRUSTED_PAY_TO_ADDRESS)
  : undefined;
const account = privateKeyToAccount(AGENT_PRIVATE_KEY as `0x${string}`);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network,
      client: new ExactEvmScheme(account),
    },
  ],
  spendControls: {
    maxAmountPerPayment: MAX_PAYMENT_USD,
  },
  policies: trustedPayTo
    ? [
        (_version, accepts) =>
          accepts.filter((accept) => getAddress(accept.payTo) === trustedPayTo),
      ]
    : undefined,
});

const url = `${API_BASE_URL.replace(/\/+$/, "")}/v1/wallet/${getAddress(
  TARGET_WALLET,
)}/summary`;

const response = await fetchWithPayment(url, {
  headers: {
    accept: "application/json",
  },
});

const body = await response.json();
const paymentResponse = response.headers.get("PAYMENT-RESPONSE");

console.log(JSON.stringify(body, null, 2));

if (paymentResponse) {
  console.log("\nPayment settlement:");
  console.log(JSON.stringify(decodePaymentResponseHeader(paymentResponse), null, 2));
}
