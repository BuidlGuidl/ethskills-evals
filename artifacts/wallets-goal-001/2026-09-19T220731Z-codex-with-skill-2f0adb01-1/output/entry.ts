import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const WETH = getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const UNISWAP_V3_SWAP_ROUTER = getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564");
const UNISWAP_V3_QUOTER_V2 = getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e");
const AAVE_V3_POOL = getAddress("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2");
const WETH_USDC_FEE = 500;
const MAX_UINT256 = (1n << 256n) - 1n;

const DELEGATE_BYTECODE =
  "0x608060405234801561000f575f80fd5b506106af8061001d5f395ff3fe60806040526004361061001e575f3560e01c806389439c551461002757005b3661002557005b005b61003a6100353660046105f3565b61004c565b60405190815260200160405180910390f35b5f33301461006d5760405163029a949d60e31b815260040160405180910390fd5b6040516370a0823160e01b81523060048201525f9073c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2906370a0823190602401602060405180830381865afa1580156100bc573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906100e0919061063c565b90505f5f1987146100f157866100f3565b815b9050805f0361011557604051631f2a200560e01b815260040160405180910390fd5b808210156101455760405163104a376960e01b815260048101839052602481018290526044015b60405180910390fd5b61017873c02aaa39b223fe8d0a0e5c4f27ead9083c756cc273e592427a0aece92de3edee1f18e0157c058615648361042e565b604080516101008101825273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48602082019081526101f48284019081523060608401908152608084018a815260a0850187815260c086018d81526001600160a01b038c811660e08901908152985163414bf38960e01b8152975181166004890152955186166024880152935162ffffff1660448701529151841660648601525160848501525160a48401525160c4830152915190911660e482015273e592427a0aece92de3edee1f18e0157c058615649063414bf38990610104016020604051808303815f875af1158015610279573d5f803e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061029d919061063c565b9250858310156102ca576040516313a30a9560e11b8152600481018490526024810187905260440161013c565b6102fd73c02aaa39b223fe8d0a0e5c4f27ead9083c756cc273e592427a0aece92de3edee1f18e0157c058615645f61042e565b61033073a0b86991c6218b36c1d19d4a2e9eb0ce3606eb487387870bca3f3fd6335c3f4ce8392d69350b4fa4e28561042e565b60405163617ba03760e01b815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486004820152602481018490523060448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b1580156103a0575f80fd5b505af11580156103b2573d5f803e3d5ffd5b505050506103e973a0b86991c6218b36c1d19d4a2e9eb0ce3606eb487387870bca3f3fd6335c3f4ce8392d69350b4fa4e25f61042e565b604080518281526020810185905230917f089d0daa5e8466fdfdab1113e8fdd98c06ef26711cafc429dabce354d007364e910160405180910390a25050949350505050565b60405163095ea7b360e01b81526001600160a01b0383811660048301526024820183905284169063095ea7b3906044016020604051808303815f875af115801561047a573d5f803e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061049e9190610653565b6105ee5760405163095ea7b360e01b81526001600160a01b0383811660048301525f602483015284169063095ea7b3906044016020604051808303815f875af11580156104ed573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105119190610653565b61054757604051636a93d39160e01b81526001600160a01b038085166004830152831660248201525f604482015260640161013c565b60405163095ea7b360e01b81526001600160a01b0383811660048301526024820183905284169063095ea7b3906044016020604051808303815f875af1158015610593573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105b79190610653565b6105ee57604051636a93d39160e01b81526001600160a01b038085166004830152831660248201526044810182905260640161013c565b505050565b5f805f8060808587031215610606575f80fd5b84359350602085013592506040850135915060608501356001600160a01b0381168114610631575f80fd5b939692955090935050565b5f6020828403121561064c575f80fd5b5051919050565b5f60208284031215610663575f80fd5b81518015158114610672575f80fd5b939250505056fea26469706673582212204ac91b26a9570d9a34be35ee68d703c775f0adab0e35346f21c109eed9c4c42364736f6c63430008140033" as const;

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

const delegateAbi = parseAbi([
  "function enterWethToAaveUsdc(uint256 wethAmountIn,uint256 minUsdcOut,uint256 deadline,uint160 sqrtPriceLimitX96) payable returns (uint256 usdcSupplied)",
  "event Entered(address indexed account,uint256 wethIn,uint256 usdcSupplied)",
]);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getPrivateKey(): Hex {
  const privateKey = requireEnv("PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex string with 0x prefix");
  }
  return privateKey as Hex;
}

function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

async function makeClients() {
  const rpcUrl = requireEnv("RPC_URL");
  const account = privateKeyToAccount(getPrivateKey());
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) });

  const chainId = await publicClient.getChainId();
  if (chainId !== 1) throw new Error(`RPC_URL is chain ${chainId}; this script is mainnet-only`);

  return { account, publicClient, walletClient };
}

async function deployDelegate() {
  const { account, publicClient, walletClient } = await makeClients();

  console.log(`Deploying WethToAaveUsdc7702Delegate from ${account.address}`);
  const hash = await walletClient.deployContract({
    account,
    abi: [],
    bytecode: DELEGATE_BYTECODE,
    chain: mainnet,
  });

  console.log(`Deploy transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("Deployment receipt did not include a contract address");
  console.log(`ENTRY_DELEGATE_ADDRESS=${receipt.contractAddress}`);
}

async function enterPosition() {
  const delegateAddress = getAddress(requireEnv("ENTRY_DELEGATE_ADDRESS")) as Address;
  const slippageBps = envInt("SLIPPAGE_BPS", 50);
  if (slippageBps > 1_000) throw new Error("Refusing SLIPPAGE_BPS above 1000 (10%)");

  const deadlineSeconds = envInt("DEADLINE_SECONDS", 20 * 60);
  const { account, publicClient, walletClient } = await makeClients();

  const delegateCode = await publicClient.getCode({ address: delegateAddress });
  if (!delegateCode || delegateCode === "0x") {
    throw new Error(`ENTRY_DELEGATE_ADDRESS ${delegateAddress} has no code`);
  }

  const [wethBalance, wethRouterAllowance, usdcAaveAllowance] = await Promise.all([
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
    publicClient.readContract({
      address: WETH,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, UNISWAP_V3_SWAP_ROUTER],
    }),
    publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, AAVE_V3_POOL],
    }),
  ]);

  if (wethBalance === 0n) throw new Error(`${account.address} has no WETH`);

  const { result: quote } = await publicClient.simulateContract({
    address: UNISWAP_V3_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: WETH,
        tokenOut: USDC,
        amountIn: wethBalance,
        fee: WETH_USDC_FEE,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const [quotedUsdcOut] = quote;
  const minUsdcOut = (quotedUsdcOut * BigInt(10_000 - slippageBps)) / 10_000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
  const data = encodeFunctionData({
    abi: delegateAbi,
    functionName: "enterWethToAaveUsdc",
    args: [MAX_UINT256, minUsdcOut, deadline, 0n],
  });

  console.log(`Account:                 ${account.address}`);
  console.log(`Delegate implementation: ${delegateAddress}`);
  console.log(`WETH balance to swap:    ${formatEther(wethBalance)} WETH`);
  console.log(`Quoted USDC out:         ${formatUnits(quotedUsdcOut, 6)} USDC`);
  console.log(`Minimum USDC out:        ${formatUnits(minUsdcOut, 6)} USDC (${slippageBps} bps slippage)`);
  console.log(`Existing WETH approval:  ${formatEther(wethRouterAllowance)} WETH to Uniswap router`);
  console.log(`Existing USDC approval:  ${formatUnits(usdcAaveAllowance, 6)} USDC to Aave V3 pool`);
  console.log(`Contracts: Uniswap router ${UNISWAP_V3_SWAP_ROUTER}, Aave pool ${AAVE_V3_POOL}`);

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: delegateAddress,
    executor: "self",
  });

  const hash = await walletClient.sendTransaction({
    account,
    authorizationList: [authorization],
    chain: mainnet,
    data,
    to: account.address,
  });

  console.log(`Entry transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Status: ${receipt.status}`);
}

async function revokeDelegation() {
  const { account, publicClient, walletClient } = await makeClients();

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: "0x0000000000000000000000000000000000000000",
    executor: "self",
  });

  const hash = await walletClient.sendTransaction({
    account,
    authorizationList: [authorization],
    chain: mainnet,
    to: account.address,
    data: "0x",
  });

  console.log(`Revoke transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Status: ${receipt.status}`);
}

async function main() {
  const command = process.argv[2] ?? "enter";
  if (command === "deploy-delegate") return deployDelegate();
  if (command === "enter") return enterPosition();
  if (command === "revoke-delegate") return revokeDelegation();

  throw new Error(`Unknown command "${command}". Use deploy-delegate, enter, or revoke-delegate.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
