import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  maxUint256,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const ADDRESSES = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  UNISWAP_V3_FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  UNISWAP_SWAP_ROUTER_02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  UNISWAP_QUOTER_V2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  AAVE_V3_POOL_ADDRESSES_PROVIDER: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
  AAVE_V3_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
} as const satisfies Record<string, Address>;

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const uniswapFactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

const aaveAddressesProviderAbi = parseAbi([
  "function getPool() view returns (address)",
]);

const quoterV2Abi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
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
] as const;

const entryImplementationAbi = [
  {
    type: "function",
    name: "enterWethToAaveUsdc",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "weth", type: "address" },
          { name: "usdc", type: "address" },
          { name: "swapRouter02", type: "address" },
          { name: "aavePool", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "amountIn", type: "uint256" },
          { name: "minUsdcOut", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
          { name: "referralCode", type: "uint16" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "usdcSupplied", type: "uint256" }],
  },
] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function readUintEnv(name: string, fallback: bigint): bigint {
  const value = process.env[name];
  return value ? BigInt(value) : fallback;
}

async function main() {
  const rpcUrl = requireEnv("RPC_URL");
  const account = privateKeyToAccount(requireEnv("PRIVATE_KEY") as Hex);

  // This must be an already deployed, verified EIP-7702 implementation whose
  // enterWethToAaveUsdc function performs the swap and Aave supply in one call.
  const entryImplementation = getAddress(requireEnv("ENTRY_IMPLEMENTATION_ADDRESS"));

  const poolFee = Number(process.env.POOL_FEE ?? "500");
  const slippageBps = Number(process.env.SLIPPAGE_BPS ?? "50");
  const referralCode = Number(process.env.AAVE_REFERRAL_CODE ?? "0");
  const deadline =
    readUintEnv("DEADLINE", BigInt(Math.floor(Date.now() / 1000) + 15 * 60));
  const sqrtPriceLimitX96 = 0n;

  if (!Number.isInteger(poolFee) || poolFee <= 0 || poolFee > 1_000_000) {
    throw new Error("POOL_FEE must be a valid Uniswap V3 fee, e.g. 500 or 3000");
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("SLIPPAGE_BPS must be between 0 and 10000");
  }

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpcUrl),
  });

  const [entryCode, accountCode, wethBalance, poolFromProvider, uniswapPool] =
    await Promise.all([
      publicClient.getBytecode({ address: entryImplementation }),
      publicClient.getBytecode({ address: account.address }),
      publicClient.readContract({
        address: ADDRESSES.WETH,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      }),
      publicClient.readContract({
        address: ADDRESSES.AAVE_V3_POOL_ADDRESSES_PROVIDER,
        abi: aaveAddressesProviderAbi,
        functionName: "getPool",
      }),
      publicClient.readContract({
        address: ADDRESSES.UNISWAP_V3_FACTORY,
        abi: uniswapFactoryAbi,
        functionName: "getPool",
        args: [ADDRESSES.WETH, ADDRESSES.USDC, poolFee],
      }),
    ]);

  if (!entryCode || entryCode === "0x") {
    throw new Error(`No code at ENTRY_IMPLEMENTATION_ADDRESS ${entryImplementation}`);
  }
  if (getAddress(poolFromProvider) !== ADDRESSES.AAVE_V3_POOL) {
    throw new Error(
      `Aave PoolAddressesProvider returned ${poolFromProvider}, expected ${ADDRESSES.AAVE_V3_POOL}`,
    );
  }
  if (uniswapPool === "0x0000000000000000000000000000000000000000") {
    throw new Error(`No WETH/USDC Uniswap V3 pool for fee ${poolFee}`);
  }

  const delegationCode =
    `0xef0100${entryImplementation.slice(2)}`.toLowerCase() as Hex;
  if (
    accountCode &&
    accountCode !== "0x" &&
    accountCode.toLowerCase() !== delegationCode
  ) {
    throw new Error(
      `Account already has code/delegation ${accountCode}; refusing to overwrite it`,
    );
  }

  const amountIn = process.env.WETH_AMOUNT
    ? parseUnits(process.env.WETH_AMOUNT, 18)
    : maxUint256;
  const quoteAmountIn = amountIn === maxUint256 ? wethBalance : amountIn;

  if (quoteAmountIn === 0n) throw new Error("Account has no WETH to enter with");
  if (quoteAmountIn > wethBalance) {
    throw new Error(
      `Requested ${formatUnits(quoteAmountIn, 18)} WETH but account only has ${formatUnits(
        wethBalance,
        18,
      )}`,
    );
  }

  const [wethRouterAllowance, usdcAaveAllowance, quote] = await Promise.all([
    publicClient.readContract({
      address: ADDRESSES.WETH,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, ADDRESSES.UNISWAP_SWAP_ROUTER_02],
    }),
    publicClient.readContract({
      address: ADDRESSES.USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, ADDRESSES.AAVE_V3_POOL],
    }),
    publicClient.simulateContract({
      account: account.address,
      address: ADDRESSES.UNISWAP_QUOTER_V2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: ADDRESSES.WETH,
          tokenOut: ADDRESSES.USDC,
          amountIn: quoteAmountIn,
          fee: poolFee,
          sqrtPriceLimitX96,
        },
      ],
    }),
  ]);

  if (wethRouterAllowance !== 0n || usdcAaveAllowance !== 0n) {
    throw new Error(
      "Expected no relevant WETH/USDC approvals. Clear existing approvals before running.",
    );
  }

  const quotedUsdcOut = quote.result[0];
  const minUsdcOut = process.env.MIN_USDC_OUT
    ? parseUnits(process.env.MIN_USDC_OUT, 6)
    : (quotedUsdcOut * BigInt(10_000 - slippageBps)) / 10_000n;

  const params = {
    weth: ADDRESSES.WETH,
    usdc: ADDRESSES.USDC,
    swapRouter02: ADDRESSES.UNISWAP_SWAP_ROUTER_02,
    aavePool: ADDRESSES.AAVE_V3_POOL,
    fee: poolFee,
    amountIn,
    minUsdcOut,
    sqrtPriceLimitX96,
    referralCode,
    deadline,
  };

  console.log(`Account: ${account.address}`);
  console.log(`WETH to swap: ${formatUnits(quoteAmountIn, 18)}`);
  console.log(`Quoted USDC: ${formatUnits(quotedUsdcOut, 6)}`);
  console.log(`Minimum USDC: ${formatUnits(minUsdcOut, 6)}`);
  console.log(`7702 implementation: ${entryImplementation}`);

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: entryImplementation,
    executor: "self",
  });

  const data = encodeFunctionData({
    abi: entryImplementationAbi,
    functionName: "enterWethToAaveUsdc",
    args: [params],
  });

  const hash = await walletClient.sendTransaction({
    account,
    chain: mainnet,
    to: account.address,
    data,
    authorizationList: [authorization],
  });

  console.log(`Submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Status: ${receipt.status}`);
  console.log(`Block: ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
