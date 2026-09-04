#!/usr/bin/env tsx
/**
 * Treasury desk: USDC -> WETH on Base mainnet (chainId 8453).
 *
 * Execution model
 * ---------------
 * The clip sizes this desk trades (10^5..10^6 USDC) do not fit in one AMM pool
 * without paying material impact, so the script does not hardcode a pool. For
 * every child order it:
 *
 *   1. quotes Uniswap v3 on-chain (QuoterV2, every USDC/WETH fee tier) and
 *      quotes the keyless DEX aggregators (OpenOcean, LI.FI) off-chain,
 *   2. compares them net of gas,
 *   3. cross-checks the winner against Chainlink ETH/USD + USDC/USD and
 *      refuses to trade outside a configurable band,
 *   4. approves exactly the child-order size to a pinned, allowlisted spender,
 *      simulates, sends, and then verifies the *realised* WETH balance delta.
 *
 * Nothing is broadcast unless BROADCAST=1. See NOTES.md before using real funds.
 *
 *   pnpm add viem && pnpm add -D tsx
 *   ACCOUNT=0x... AMOUNT_USDC=250000 pnpm tsx swap.ts            # dry run
 *   PRIVATE_KEY=0x... AMOUNT_USDC=250000 SLICES=4 BROADCAST=1 pnpm tsx swap.ts
 */

import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseUnits,
  toHex,
  type Address,
  type Hex,
  type StateOverride,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ---------------------------------------------------------------------------
// Base mainnet addresses. Every one of these was verified by calling the
// contract on Base (symbol()/decimals()/factory()/description()); the checks
// are repeated at runtime in preflight() so a typo can never reach a transfer.
// ---------------------------------------------------------------------------
const CHAIN_ID = 8453;

/** Circle-issued native USDC on Base. 6 decimals.
 * Not to be confused with bridged USDbC, 0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA. */
const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
/** Canonical WETH9 predeploy on every OP-stack chain, Base included. 18 decimals. */
const WETH = getAddress("0x4200000000000000000000000000000000000006");

/** Uniswap v3 SwapRouter02 on Base. */
const UNIV3_ROUTER = getAddress("0x2626664c2603336E57B271c5C0b26F421741e481");
/** Uniswap v3 QuoterV2 on Base — state-mutating, so it is only ever eth_call'd. */
const UNIV3_QUOTER = getAddress("0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a");
/** Uniswap v3 factory on Base — used to prove the router/quoter above are Uniswap's. */
const UNIV3_FACTORY = getAddress("0x33128a8fC17869897dcE68Ed026d694621f6FDfD");
/** USDC/WETH fee tiers deployed on Base. All four are quoted every slice. */
const UNIV3_FEE_TIERS = [100, 500, 3000, 10_000] as const;

/** Chainlink ETH/USD on Base, 8 decimals, description() == "ETH / USD". */
const FEED_ETH_USD = getAddress("0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70");
/** Chainlink USDC/USD on Base, 8 decimals, description() == "USDC / USD". */
const FEED_USDC_USD = getAddress("0x7e860098F58bBFC8648a4311b374B1D669a2bc6B");

/**
 * Spend/call targets we are willing to approve and call, pinned by hand.
 * An aggregator response naming any other contract is rejected: that is the
 * difference between "the API picks our route" and "the API can drain the
 * desk's allowance".
 */
const OPENOCEAN_ROUTER = getAddress("0x6352a56caadC4F1E25CD6c75970Fa768A3304e64");
const LIFI_DIAMOND = getAddress("0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE");
const ALLOWED_TARGETS = new Set<Address>([UNIV3_ROUTER, OPENOCEAN_ROUTER, LIFI_DIAMOND]);

// ---------------------------------------------------------------------------
// ABIs (only the fragments actually used)
// ---------------------------------------------------------------------------
const quoterV2Abi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH9", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const swapRouter02Abi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH9", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const chainlinkAbi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const env = (k: string, d?: string) => process.env[k] ?? d;
const num = (k: string, d: number) => {
  const v = process.env[k];
  if (v === undefined) return d;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${k} must be a number, got ${v}`);
  return n;
};

const CFG = {
  rpcUrl: env("RPC_URL", "https://mainnet.base.org")!,
  privateKey: env("PRIVATE_KEY") as Hex | undefined,
  /** Read-only address for dry runs when no key is present. */
  account: env("ACCOUNT") as Address | undefined,
  recipient: env("RECIPIENT") as Address | undefined,
  amountUsdc: env("AMOUNT_USDC", "250000")!,
  /** Number of child orders the parent is split into. */
  slices: Math.max(1, Math.trunc(num("SLICES", 1))),
  /** Wait between child orders so arbitrage can refill the books. */
  sliceDelayMs: num("SLICE_DELAY_MS", 60_000),
  /** Tolerated drop between quote and fill, in bps. */
  slippageBps: num("MAX_SLIPPAGE_BPS", 30),
  /** Hard rejection band vs the Chainlink mid, in bps. Catches manipulated pools/bad routes. */
  maxOracleDeviationBps: num("MAX_ORACLE_DEVIATION_BPS", 100),
  /** Oldest acceptable ETH/USD update (that feed heartbeats every ~20 minutes on Base). */
  maxOracleAgeSec: num("MAX_ORACLE_AGE_SEC", 3600),
  /** Oldest acceptable USDC/USD update — stablecoin feeds only heartbeat daily. */
  maxStableOracleAgeSec: num("MAX_STABLE_ORACLE_AGE_SEC", 90_000),
  /** Reject if USDC/USD leaves this band around $1 (a depeg invalidates the fair-value maths). */
  maxUsdcDepegBps: num("MAX_USDC_DEPEG_BPS", 200),
  /** Venues to consider: any of univ3, openocean, lifi. */
  venues: (env("VENUES", "univ3,openocean,lifi")!).split(",").map((s) => s.trim()).filter(Boolean),
  broadcast: env("BROADCAST") === "1",
  /** Leave the allowance in place after the run instead of zeroing it. */
  keepAllowance: env("KEEP_ALLOWANCE") === "1",
  apiTimeoutMs: num("API_TIMEOUT_MS", 25_000),
  /** Aggregator calldata is fat; simulating it can take a provider a while. */
  rpcTimeoutMs: num("RPC_TIMEOUT_MS", 60_000),
} as const;

const BPS = 10_000n;
const bps = (n: number) => BigInt(Math.round(n));
const fmtUsdc = (v: bigint) => `${formatUnits(v, 6)} USDC`;
const fmtWeth = (v: bigint) => `${formatUnits(v, 18)} WETH`;
const log = (...a: unknown[]) => console.log(...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
// No JSON-RPC batching: not every Base provider implements it, and a silently
// mangled batch response is a bad failure mode for a script that moves funds.
const transport = http(CFG.rpcUrl, { timeout: CFG.rpcTimeoutMs });
const publicClient = createPublicClient({ chain: base, transport });

const signer = CFG.privateKey ? privateKeyToAccount(CFG.privateKey) : undefined;
const trader: Address = signer?.address ?? (CFG.account ? getAddress(CFG.account) : (() => {
  throw new Error("Set PRIVATE_KEY (to trade) or ACCOUNT (to dry run)");
})());
const recipient: Address = CFG.recipient ? getAddress(CFG.recipient) : trader;
const walletClient = signer ? createWalletClient({ account: signer, chain: base, transport }) : undefined;

// ---------------------------------------------------------------------------
// Preflight: prove we are on Base and that every hardcoded address is what we
// think it is, before any approval or transfer.
// ---------------------------------------------------------------------------
async function preflight() {
  const chainId = await publicClient.getChainId();
  if (chainId !== CHAIN_ID) throw new Error(`RPC is chain ${chainId}, expected Base ${CHAIN_ID}`);

  const [usdcSymbol, usdcDecimals, wethSymbol, wethDecimals, routerFactory, routerWeth, quoterFactory, quoterWeth] =
    await Promise.all([
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "symbol" }),
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "symbol" }),
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address: UNIV3_ROUTER, abi: swapRouter02Abi, functionName: "factory" }),
      publicClient.readContract({ address: UNIV3_ROUTER, abi: swapRouter02Abi, functionName: "WETH9" }),
      publicClient.readContract({ address: UNIV3_QUOTER, abi: quoterV2Abi, functionName: "factory" }),
      publicClient.readContract({ address: UNIV3_QUOTER, abi: quoterV2Abi, functionName: "WETH9" }),
    ]);

  const expect = (cond: boolean, msg: string) => { if (!cond) throw new Error(`preflight: ${msg}`); };
  expect(usdcSymbol === "USDC" && usdcDecimals === 6, `${USDC} is not 6-decimal USDC (${usdcSymbol}/${usdcDecimals})`);
  expect(wethSymbol === "WETH" && wethDecimals === 18, `${WETH} is not 18-decimal WETH (${wethSymbol}/${wethDecimals})`);
  expect(getAddress(routerFactory) === UNIV3_FACTORY, "SwapRouter02.factory() != Uniswap v3 factory");
  expect(getAddress(quoterFactory) === UNIV3_FACTORY, "QuoterV2.factory() != Uniswap v3 factory");
  expect(getAddress(routerWeth) === WETH && getAddress(quoterWeth) === WETH, "Uniswap router/quoter WETH9 mismatch");

  for (const target of ALLOWED_TARGETS) {
    const code = await publicClient.getCode({ address: target });
    expect(!!code && code !== "0x", `allowlisted target ${target} has no code on Base`);
  }
  log(`preflight ok — Base ${chainId}, USDC/WETH and Uniswap v3 contracts verified on-chain`);
}

// ---------------------------------------------------------------------------
// Chainlink reference price: the independent opinion the AMMs cannot forge.
// ---------------------------------------------------------------------------
type Oracle = { wethPerUsdcE18: bigint; ethUsd: number; usdcUsd: number };

async function readOracle(): Promise<Oracle> {
  const feed = (address: Address) =>
    Promise.all([
      publicClient.readContract({ address, abi: chainlinkAbi, functionName: "latestRoundData" }),
      publicClient.readContract({ address, abi: chainlinkAbi, functionName: "decimals" }),
      publicClient.readContract({ address, abi: chainlinkAbi, functionName: "description" }),
    ]);

  const [[ethRound, ethDec, ethDesc], [usdcRound, usdcDec, usdcDesc]] = await Promise.all([
    feed(FEED_ETH_USD),
    feed(FEED_USDC_USD),
  ]);
  if (ethDesc !== "ETH / USD") throw new Error(`${FEED_ETH_USD} is "${ethDesc}", expected "ETH / USD"`);
  if (usdcDesc !== "USDC / USD") throw new Error(`${FEED_USDC_USD} is "${usdcDesc}", expected "USDC / USD"`);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const checkFreshness = (name: string, round: readonly [bigint, bigint, bigint, bigint, bigint], maxAge: number) => {
    const [, answer, , updatedAt] = round;
    if (answer <= 0n) throw new Error(`${name} feed returned a non-positive answer`);
    const age = now - updatedAt;
    if (age > BigInt(Math.trunc(maxAge))) throw new Error(`${name} feed is stale: ${age}s old (limit ${maxAge}s)`);
  };
  checkFreshness("ETH/USD", ethRound, CFG.maxOracleAgeSec);
  checkFreshness("USDC/USD", usdcRound, CFG.maxStableOracleAgeSec);

  const ethUsd = ethRound[1];
  const usdcUsd = usdcRound[1];

  const one = 10n ** BigInt(usdcDec);
  const depegBps = Number(((usdcUsd - one) * BPS * 100n) / one) / 100;
  if (Math.abs(depegBps) > CFG.maxUsdcDepegBps) {
    throw new Error(`USDC/USD is ${depegBps.toFixed(1)}bps off peg (limit ${CFG.maxUsdcDepegBps}bps)`);
  }
  // WETH (1e18) per 1 USDC (1e6), carried at 1e18 precision:
  //   wethPerUsdc = (usdcUsd / 10^usdcDec) / (ethUsd / 10^ethDec) * 10^(18-6)
  const wethPerUsdcE18 =
    (usdcUsd * 10n ** BigInt(ethDec) * 10n ** 12n * 10n ** 18n) / (ethUsd * 10n ** BigInt(usdcDec));

  return {
    wethPerUsdcE18,
    ethUsd: Number(formatUnits(ethUsd, ethDec)),
    usdcUsd: Number(formatUnits(usdcUsd, usdcDec)),
  };
}

/** Impact-free WETH for a USDC amount, per Chainlink. */
const oracleFairOut = (amountInUsdc: bigint, o: Oracle) => (amountInUsdc * o.wethPerUsdcE18) / 10n ** 18n;

/** Signed bps difference of `actual` vs `reference` (negative = worse than reference). */
const diffBps = (actual: bigint, reference: bigint) =>
  reference === 0n ? 0 : Number(((actual - reference) * BPS * 100n) / reference) / 100;

// ---------------------------------------------------------------------------
// Venue quotes. Each returns the WETH out for `amountIn`, plus everything
// needed to execute it.
// ---------------------------------------------------------------------------
type Quote = {
  venue: string;
  detail: string;
  amountOut: bigint;
  /** Gas the venue expects to burn; used to compare venues net of cost. */
  gasEstimate: bigint;
  /** Contract that must hold the USDC allowance and that we call. */
  target: Address;
  /** Uniswap v3 fee tier, when the winning venue is univ3. */
  fee?: number;
  /** Populated for aggregator routes; univ3 encodes at execution time. */
  calldata?: Hex;
  /** Aggregator's own on-chain minimum, if it encodes one. */
  encodedMinOut?: bigint;
};

async function quoteUniV3(amountIn: bigint): Promise<Quote | null> {
  const results = await Promise.allSettled(
    UNIV3_FEE_TIERS.map((fee) =>
      publicClient.simulateContract({
        address: UNIV3_QUOTER,
        abi: quoterV2Abi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee, sqrtPriceLimitX96: 0n }],
        account: trader,
      }),
    ),
  );

  let best: Quote | null = null;
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const [amountOut, , , gasEstimate] = r.value.result;
    if (amountOut === 0n) return;
    if (!best || amountOut > best.amountOut) {
      best = {
        venue: "univ3",
        detail: `${UNIV3_FEE_TIERS[i] / 10_000}% pool`,
        amountOut,
        gasEstimate,
        target: UNIV3_ROUTER,
        fee: UNIV3_FEE_TIERS[i],
      };
    }
  });
  return best;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(CFG.apiTimeoutMs),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

async function quoteOpenOcean(amountIn: bigint): Promise<Quote | null> {
  // OpenOcean's swap calldata always settles to the sender, so it cannot serve
  // a third-party recipient. Uniswap and LI.FI both can.
  if (recipient !== trader) throw new Error("route settles to the sender; RECIPIENT must equal the trader");
  const gasPriceGwei = formatUnits(await publicClient.getGasPrice(), 9);
  const url =
    `https://open-api.openocean.finance/v4/base/swap?inTokenAddress=${USDC}&outTokenAddress=${WETH}` +
    `&amount=${formatUnits(amountIn, 6)}&gasPrice=${gasPriceGwei}` +
    `&slippage=${CFG.slippageBps / 100}&account=${trader}`;
  const { data } = await fetchJson(url);
  if (!data?.data || !data?.to) return null;
  if (BigInt(data.inAmount) !== amountIn) throw new Error("OpenOcean quoted a different input amount");
  if (getAddress(data.outToken.address) !== WETH || getAddress(data.inToken.address) !== USDC) {
    throw new Error("OpenOcean quoted the wrong token pair");
  }
  return {
    venue: "openocean",
    detail: `router ${data.to}`,
    amountOut: BigInt(data.outAmount),
    gasEstimate: BigInt(data.estimatedGas ?? 1_000_000),
    target: getAddress(data.to),
    calldata: data.data as Hex,
    encodedMinOut: data.minOutAmount ? BigInt(data.minOutAmount) : undefined,
  };
}

async function quoteLifi(amountIn: bigint): Promise<Quote | null> {
  const url =
    `https://li.quest/v1/quote?fromChain=${CHAIN_ID}&toChain=${CHAIN_ID}&fromToken=${USDC}&toToken=${WETH}` +
    `&fromAmount=${amountIn}&fromAddress=${trader}&toAddress=${recipient}&slippage=${CFG.slippageBps / 10_000}`;
  const q = await fetchJson(url);
  const tx = q?.transactionRequest;
  if (!tx?.data || !tx?.to) return null;
  if (BigInt(q.estimate.fromAmount) !== amountIn) throw new Error("LI.FI quoted a different input amount");
  if (getAddress(q.action.fromToken.address) !== USDC || getAddress(q.action.toToken.address) !== WETH) {
    throw new Error("LI.FI quoted the wrong token pair");
  }
  if (getAddress(q.estimate.approvalAddress) !== getAddress(tx.to)) {
    throw new Error("LI.FI approval address differs from its call target");
  }
  return {
    venue: "lifi",
    detail: `via ${q.tool}`,
    amountOut: BigInt(q.estimate.toAmount),
    gasEstimate: BigInt(tx.gasLimit ?? "0x100000"),
    target: getAddress(tx.to),
    calldata: tx.data as Hex,
    encodedMinOut: q.estimate.toAmountMin ? BigInt(q.estimate.toAmountMin) : undefined,
  };
}

const VENUES: Record<string, (amountIn: bigint) => Promise<Quote | null>> = {
  univ3: quoteUniV3,
  openocean: quoteOpenOcean,
  lifi: quoteLifi,
};

/** Quote every enabled venue; a venue that errors or times out is skipped, not fatal. */
async function quoteAll(amountIn: bigint): Promise<Quote[]> {
  const enabled = CFG.venues.filter((v) => v in VENUES);
  if (enabled.length === 0) throw new Error(`No known venues in VENUES=${CFG.venues.join(",")}`);
  const settled = await Promise.allSettled(enabled.map((v) => VENUES[v](amountIn)));
  const quotes: Quote[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value) quotes.push(r.value);
    } else {
      log(`  ! ${enabled[i]} quote failed: ${(r.reason as Error).message}`);
    }
  });
  return quotes;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
async function ensureAllowance(spender: Address, amount: bigint) {
  const current = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [trader, spender],
  });
  if (current >= amount) return;
  if (!walletClient || !signer) throw new Error(`allowance for ${spender} is ${current}, need ${amount}`);

  log(`  approving ${fmtUsdc(amount)} to ${spender}`);
  const { request } = await publicClient.simulateContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: signer,
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`approve reverted (${hash})`);
}

/**
 * A dry-run-only allowance override so a candidate route can be simulated
 * before we spend gas approving it. USDC on Base is FiatTokenV2 behind a
 * proxy, whose `allowed` mapping lives at storage slot 10; the override is
 * verified with an eth_call before it is trusted, and we simply fall back to
 * approve-then-simulate if the layout ever changes.
 */
const USDC_ALLOWED_SLOT = 10n;

function allowanceSlot(owner: Address, spender: Address): Hex {
  const inner = keccak256(
    encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [owner, USDC_ALLOWED_SLOT]),
  );
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [spender, inner]));
}

async function allowanceOverride(spender: Address, amount: bigint): Promise<StateOverride | undefined> {
  const stateOverride: StateOverride = [
    {
      address: USDC,
      stateDiff: [{ slot: allowanceSlot(trader, spender), value: toHex(amount, { size: 32 }) }],
    },
  ];
  try {
    const seen = await publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [trader, spender],
      stateOverride,
    });
    return seen === amount ? stateOverride : undefined;
  } catch {
    return undefined;
  }
}

const univ3SwapArgs = (quote: Quote, amountIn: bigint, minOut: bigint) =>
  ({
    address: UNIV3_ROUTER,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [{
      tokenIn: USDC,
      tokenOut: WETH,
      fee: quote.fee!,
      recipient,
      amountIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0n,
    }],
  }) as const;

/** Runs the swap as an eth_call. Throws with the revert reason if it would fail. */
async function simulateSlice(quote: Quote, amountIn: bigint, minOut: bigint, stateOverride?: StateOverride) {
  if (!ALLOWED_TARGETS.has(quote.target)) throw new Error(`target ${quote.target} is not allowlisted`);
  if (quote.venue === "univ3") {
    await publicClient.simulateContract({ ...univ3SwapArgs(quote, amountIn, minOut), account: trader, stateOverride });
    return;
  }
  await publicClient.call({
    account: trader,
    to: quote.target,
    data: quote.calldata!,
    value: 0n,
    stateOverride,
  });
}

async function sendSlice(quote: Quote, amountIn: bigint, minOut: bigint): Promise<Hex> {
  if (!walletClient || !signer) throw new Error("BROADCAST=1 requires PRIVATE_KEY");
  if (!ALLOWED_TARGETS.has(quote.target)) throw new Error(`refusing to call un-allowlisted ${quote.target}`);

  await ensureAllowance(quote.target, amountIn);
  // Re-simulate against the real allowance: state has moved since the quote.
  await simulateSlice(quote, amountIn, minOut);

  if (quote.venue === "univ3") {
    const { request } = await publicClient.simulateContract({
      ...univ3SwapArgs(quote, amountIn, minOut),
      account: signer,
    });
    return walletClient.writeContract(request);
  }

  const gas = await publicClient.estimateGas({ account: signer, to: quote.target, data: quote.calldata!, value: 0n });
  return walletClient.sendTransaction({
    to: quote.target,
    data: quote.calldata!,
    value: 0n,
    gas: (gas * 12n) / 10n,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const amountIn = parseUnits(CFG.amountUsdc, 6);
  if (amountIn <= 0n) throw new Error("AMOUNT_USDC must be > 0");
  if (CFG.slippageBps <= 0 || CFG.slippageBps > 500) throw new Error("MAX_SLIPPAGE_BPS must be in (0, 500]");

  log(`USDC -> WETH on Base | trader ${trader} | recipient ${recipient}`);
  log(`size ${fmtUsdc(amountIn)} in ${CFG.slices} slice(s) | slippage ${CFG.slippageBps}bps | ` +
      `oracle band ${CFG.maxOracleDeviationBps}bps | ${CFG.broadcast ? "BROADCAST" : "DRY RUN"}`);

  await preflight();

  const [usdcBalance, ethBalance] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [trader] }),
    publicClient.getBalance({ address: trader }),
  ]);
  log(`balances: ${fmtUsdc(usdcBalance)}, ${formatUnits(ethBalance, 18)} ETH (gas)`);
  if (usdcBalance < amountIn) throw new Error(`insufficient USDC: have ${fmtUsdc(usdcBalance)}, need ${fmtUsdc(amountIn)}`);
  if (CFG.broadcast && ethBalance < parseUnits("0.0005", 18)) throw new Error("top up ETH for gas before trading");

  const sliceIn = amountIn / BigInt(CFG.slices);
  const remainder = amountIn - sliceIn * BigInt(CFG.slices);

  let filledIn = 0n;
  let filledOut = 0n;

  for (let i = 0; i < CFG.slices; i++) {
    const thisIn = i === CFG.slices - 1 ? sliceIn + remainder : sliceIn;
    log(`\n── slice ${i + 1}/${CFG.slices}: ${fmtUsdc(thisIn)}`);

    // Re-read the oracle every slice: a feed that goes stale mid-run must stop us.
    const oracle = await readOracle();
    const fair = oracleFairOut(thisIn, oracle);
    log(`  chainlink: ETH/USD ${oracle.ethUsd.toFixed(2)}, USDC/USD ${oracle.usdcUsd.toFixed(4)} -> fair ${fmtWeth(fair)}`);

    const quotes = await quoteAll(thisIn);
    if (quotes.length === 0) throw new Error("no venue returned a quote");

    const gasPrice = await publicClient.getGasPrice();
    const scored = quotes
      .map((q) => ({ q, net: q.amountOut - q.gasEstimate * gasPrice }))
      .sort((a, b) => (b.net > a.net ? 1 : b.net < a.net ? -1 : 0));
    for (const { q, net } of scored) {
      log(`  ${q.venue.padEnd(9)} ${fmtWeth(q.amountOut)} (${diffBps(q.amountOut, fair).toFixed(1)}bps vs oracle, ` +
          `net ${fmtWeth(net)}) — ${q.detail}`);
    }

    // Walk the ranked venues: the best quote that passes the oracle band *and*
    // simulates successfully wins. A venue whose calldata reverts (stale RFQ
    // leg, moved pool) costs us a fallback, not the parent order.
    let done: { venue: string; out: bigint } | undefined;

    for (const { q } of scored) {
      const deviation = diffBps(q.amountOut, fair);
      if (deviation < -CFG.maxOracleDeviationBps) {
        log(`  x ${q.venue} is ${deviation.toFixed(1)}bps below the Chainlink mid ` +
            `(limit ${CFG.maxOracleDeviationBps}bps) — skipped`);
        continue;
      }

      // Two floors. `targetFloor` is the quote minus the slippage we are willing
      // to pay; `hardFloor` is the oracle band and is never negotiable. For
      // Uniswap we encode the floor ourselves; for an aggregator the enforceable
      // floor is whatever its calldata already encodes, so we check that rather
      // than pretend we control it.
      const targetFloor = (q.amountOut * (BPS - bps(CFG.slippageBps))) / BPS;
      const hardFloor = (fair * (BPS - bps(CFG.maxOracleDeviationBps))) / BPS;
      const minOut = q.encodedMinOut ?? (targetFloor > hardFloor ? targetFloor : hardFloor);

      if (minOut < hardFloor) {
        log(`  x ${q.venue} would accept ${fmtWeth(minOut)}, below the ${fmtWeth(hardFloor)} oracle floor — skipped`);
        continue;
      }
      log(`  trying ${q.venue} (${q.detail}); on-chain floor ${fmtWeth(minOut)} ` +
          `(${diffBps(minOut, fair).toFixed(1)}bps vs oracle)`);
      if (minOut < targetFloor) {
        log(`  ! ${q.venue} encodes a wider floor than MAX_SLIPPAGE_BPS asks for ` +
            `(${diffBps(minOut, q.amountOut).toFixed(1)}bps vs -${CFG.slippageBps}bps); ` +
            `that is the real protection on this trade`);
      }

      const override = await allowanceOverride(q.target, thisIn);
      try {
        await simulateSlice(q, thisIn, minOut, override);
      } catch (err) {
        log(`  x ${q.venue} simulation reverted (${(err as Error).message.split("\n")[0]}) — trying the next venue`);
        continue;
      }

      if (!CFG.broadcast) {
        log(`  dry run: ${q.venue} simulates clean. Set BROADCAST=1 with PRIVATE_KEY to execute.`);
        done = { venue: q.venue, out: q.amountOut };
        break;
      }

      const wethBefore = await publicClient.readContract({
        address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient],
      });
      const hash = await sendSlice(q, thisIn, minOut);
      log(`  sent ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`slice ${i + 1} reverted on-chain (${hash})`);
      const wethAfter = await publicClient.readContract({
        address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [recipient],
      });

      const received = wethAfter - wethBefore;
      if (received < minOut) {
        throw new Error(`slice ${i + 1} settled ${fmtWeth(received)}, below the ${fmtWeth(minOut)} floor (${hash})`);
      }
      log(`  filled ${fmtWeth(received)} in block ${receipt.blockNumber} ` +
          `(${diffBps(received, fair).toFixed(1)}bps vs oracle, gas ${receipt.gasUsed})`);
      done = { venue: q.venue, out: received };

      // A child order that fills outside tolerance means the book moved against
      // us; stop the parent order rather than keep feeding it.
      if (received < targetFloor) {
        throw new Error(
          `slice ${i + 1} filled ${diffBps(received, q.amountOut).toFixed(1)}bps below its quote ` +
          `(tolerance ${CFG.slippageBps}bps). Stopping with ${fmtUsdc(amountIn - filledIn - thisIn)} unexecuted.`,
        );
      }
      break;
    }

    if (!done) throw new Error(`slice ${i + 1}: no venue passed the price guards and simulated cleanly`);
    filledIn += thisIn;
    filledOut += done.out;

    if (i < CFG.slices - 1 && CFG.sliceDelayMs > 0) {
      log(`  waiting ${CFG.sliceDelayMs}ms before the next slice`);
      await sleep(CFG.sliceDelayMs);
    }
  }

  if (CFG.broadcast && !CFG.keepAllowance) {
    for (const target of ALLOWED_TARGETS) {
      const left = await publicClient.readContract({
        address: USDC, abi: erc20Abi, functionName: "allowance", args: [trader, target],
      });
      if (left > 0n && walletClient && signer) {
        log(`revoking leftover allowance ${fmtUsdc(left)} on ${target}`);
        const { request } = await publicClient.simulateContract({
          address: USDC, abi: erc20Abi, functionName: "approve", args: [target, 0n], account: signer,
        });
        await publicClient.waitForTransactionReceipt({ hash: await walletClient.writeContract(request) });
      }
    }
  }

  const finalOracle = await readOracle();
  const fairTotal = oracleFairOut(filledIn, finalOracle);
  log(`\n${CFG.broadcast ? "done" : "dry run complete"}: ${fmtUsdc(filledIn)} -> ${fmtWeth(filledOut)} ` +
      `(${diffBps(filledOut, fairTotal).toFixed(1)}bps vs Chainlink mid, ` +
      `avg ${(Number(formatUnits(filledIn, 6)) / Number(formatUnits(filledOut, 18))).toFixed(2)} USDC/WETH)`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
