import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddressEqual,
  keccak256,
  parseUnits,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const CHAIN_ID = 1;

const WETH = getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const UNISWAP_V3_SWAP_ROUTER = getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564");
const AAVE_V3_POOL = getAddress("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2");
const AAVE_V3_POOL_ADDRESSES_PROVIDER = getAddress("0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e");

const DEFAULT_UNISWAP_POOL_FEE = 500; // WETH/USDC 0.05% pool.

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;

const poolAddressesProviderAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const satisfies Abi;

const delegateAbi = [
  {
    type: "function",
    name: "enter",
    stateMutability: "payable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "minUsdcOut", type: "uint256" },
      { name: "poolFee", type: "uint24" },
      { name: "deadline", type: "uint256" },
      { name: "resetApprovals", type: "bool" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const satisfies Abi;

const delegateSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

contract OneClickWethUsdcAave7702 {
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant UNISWAP_V3_SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    error OnlySelf();
    error ZeroAmount();
    error Expired();

    function enter(
        uint256 amountIn,
        uint256 minUsdcOut,
        uint24 poolFee,
        uint256 deadline,
        bool resetApprovals
    ) external payable returns (uint256 amountOut) {
        if (msg.sender != address(this)) revert OnlySelf();
        if (amountIn == 0) revert ZeroAmount();
        if (block.timestamp > deadline) revert Expired();

        IERC20(WETH).approve(UNISWAP_V3_SWAP_ROUTER, 0);
        IERC20(WETH).approve(UNISWAP_V3_SWAP_ROUTER, amountIn);

        amountOut = ISwapRouter(UNISWAP_V3_SWAP_ROUTER).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: poolFee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: 0
            })
        );

        if (resetApprovals) IERC20(WETH).approve(UNISWAP_V3_SWAP_ROUTER, 0);

        IERC20(USDC).approve(AAVE_V3_POOL, 0);
        IERC20(USDC).approve(AAVE_V3_POOL, amountOut);
        IAavePool(AAVE_V3_POOL).supply(USDC, amountOut, address(this), 0);

        if (resetApprovals) IERC20(USDC).approve(AAVE_V3_POOL, 0);
    }

    receive() external payable {}
}`;

const delegateCreationBytecode =
  "0x6080604052348015600e575f5ffd5b5061082d8061001c5f395ff3fe608060405260043610610020575f3560e01c80635e4a81d11461002b575f5ffd5b3661002757005b5f5ffd5b61003e6100393660046106a0565b610050565b60405190815260200160405180910390f35b5f33301461008a576040517f14d4a4e800000000000000000000000000000000000000000000000000000815260040160405180910390fd5b855f036100c3576040517f1f2a200500000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b824211156100fd576040517f203d82d800000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6040517f095ea7b300000000000000000000000000000000000000000000000000000000815273e592427a0aece92de3edee1f18e0157c0586156460048201525f602482015273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc29063095ea7b3906044016020604051808303815f875af115801561017e573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101a291906106f9565b506040517f095ea7b300000000000000000000000000000000000000000000000000000000815273e592427a0aece92de3edee1f18e0157c0586156460048201526024810187905273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc29063095ea7b3906044016020604051808303815f875af1158015610225573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061024991906106f9565b50604080516101008101825273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48602082015262ffffff8616818301523060608201526080810185905260a0810188905260c081018790525f60e082015290517f414bf38900000000000000000000000000000000000000000000000000000000815273e592427a0aece92de3edee1f18e0157c058615649163414bf389916102ff919060040161071b565b6020604051808303815f875af115801561031b573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061033f91906107e0565b905081156103ee576040517f095ea7b300000000000000000000000000000000000000000000000000000000815273e592427a0aece92de3edee1f18e0157c0586156460048201525f602482015273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc29063095ea7b3906044016020604051808303815f875af11580156103c8573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103ec91906106f9565b505b6040517f095ea7b30000000000000000000000000000000000000000000000000000000081527387870bca3f3fd6335c3f4ce8392d69350b4fa4e260048201525f602482015273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb489063095ea7b3906044016020604051808303815f875af115801561046f573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061049391906106f9565b506040517f095ea7b30000000000000000000000000000000000000000000000000000000081527387870bca3f3fd6335c3f4ce8392d69350b4fa4e260048201526024810182905273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb489063095ea7b3906044016020604051808303815f875af1158015610516573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061053a91906106f9565b506040517f617ba03700000000000000000000000000000000000000000000000000000000815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486004820152602481018290523060448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b1580156105c4575f5ffd5b505af11580156105d6573d5f5f3e3d5ffd5b505050508115610687576040517f095ea7b30000000000000000000000000000000000000000000000000000000081527387870bca3f3fd6335c3f4ce8392d69350b4fa4e260048201525f602482015273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb489063095ea7b3906044016020604051808303815f875af1158015610661573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061068591906106f9565b505b95945050505050565b801515811461069d575f5ffd5b50565b5f5f5f5f5f60a086880312156106b4575f5ffd5b8535945060208601359350604086013562ffffff811681146106d4575f5ffd5b92506060860135915060808601356106eb81610690565b809150509295509295909350565b5f60208284031215610709575f5ffd5b815161071481610690565b9392505050565b5f6101008201905073ffffffffffffffffffffffffffffffffffffffff835116825273ffffffffffffffffffffffffffffffffffffffff602084015116602083015262ffffff60408401511660408301526060830151610793606084018273ffffffffffffffffffffffffffffffffffffffff169052565b506080830151608083015260a083015160a083015260c083015160c083015260e08301516107d960e084018273ffffffffffffffffffffffffffffffffffffffff169052565b5092915050565b5f602082840312156107f0575f5ffd5b505191905056fea2646970667358221220848edb6334d3128c47e518fb810a29788a41f33991a4b2b65cbedee276a8531164736f6c63430008250033" as const satisfies Hex;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  return value ? getAddress(value) : undefined;
}

function asPrivateKey(value: string): Hex {
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) throw new Error("PRIVATE_KEY must be a 32-byte hex key");
  return prefixed as Hex;
}

async function main() {
  const rpcUrl = env("MAINNET_RPC_URL");
  const account = privateKeyToAccount(asPrivateKey(env("PRIVATE_KEY")));
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) });

  const chainId = await publicClient.getChainId();
  if (chainId !== CHAIN_ID) throw new Error(`Refusing to run on chain ${chainId}; expected Ethereum mainnet (${CHAIN_ID})`);

  if (process.argv.includes("--clear-delegate")) {
    const authorization = await walletClient.signAuthorization({
      account,
      contractAddress: zeroAddress,
      executor: "self",
    });
    const tx = {
      account,
      chain: mainnet,
      to: account.address,
      value: 0n,
      data: "0x",
      authorizationList: [authorization],
    } as const;
    const gas = await publicClient.estimateGas(tx);
    console.log(`clear delegation for: ${account.address}`);
    console.log(`estimated gas: ${gas}`);

    if (process.env.SEND !== "true") {
      console.log("Dry run only. Set SEND=true to submit the clearing transaction.");
      return;
    }

    const hash = await walletClient.sendTransaction({ ...tx, gas: (gas * 120n) / 100n });
    console.log(`tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`status: ${receipt.status}`);
    return;
  }

  if (process.argv.includes("--deploy-delegate")) {
    console.log(`Deploying OneClickWethUsdcAave7702 from ${account.address}`);
    console.log("Solidity source used for this bytecode is embedded in entry.ts as delegateSource.");
    const hash = await walletClient.deployContract({ account, abi: [], bytecode: delegateCreationBytecode });
    console.log(`deploy tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error("Deployment did not return a contract address");
    const code = await publicClient.getCode({ address: receipt.contractAddress });
    console.log(`delegate: ${receipt.contractAddress}`);
    console.log(`runtime code hash: ${code ? keccak256(code) : "0x"}`);
    return;
  }

  const delegate = optionalAddress("DELEGATE_IMPLEMENTATION");
  if (!delegate) {
    throw new Error("Missing DELEGATE_IMPLEMENTATION. Predeploy the delegate with --deploy-delegate, then set this address.");
  }

  const [delegateCode, routerCode, poolCode, providerPool, wethBalance] = await Promise.all([
    publicClient.getCode({ address: delegate }),
    publicClient.getCode({ address: UNISWAP_V3_SWAP_ROUTER }),
    publicClient.getCode({ address: AAVE_V3_POOL }),
    publicClient.readContract({
      address: AAVE_V3_POOL_ADDRESSES_PROVIDER,
      abi: poolAddressesProviderAbi,
      functionName: "getPool",
    }),
    publicClient.readContract({
      address: WETH,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);

  if (!delegateCode) throw new Error(`No code at DELEGATE_IMPLEMENTATION ${delegate}`);
  if (!routerCode) throw new Error(`No code at Uniswap V3 SwapRouter ${UNISWAP_V3_SWAP_ROUTER}`);
  if (!poolCode) throw new Error(`No code at Aave V3 Pool ${AAVE_V3_POOL}`);
  if (!isAddressEqual(providerPool, AAVE_V3_POOL)) {
    throw new Error(`Aave provider now points at ${providerPool}; update the delegate before using it`);
  }

  const expectedDelegateCodeHash = process.env.EXPECTED_DELEGATE_CODE_HASH as Hex | undefined;
  const delegateCodeHash = keccak256(delegateCode);
  if (expectedDelegateCodeHash && expectedDelegateCodeHash !== delegateCodeHash) {
    throw new Error(`Delegate code hash mismatch. got ${delegateCodeHash}, expected ${expectedDelegateCodeHash}`);
  }

  const amountIn = process.env.WETH_AMOUNT
    ? parseUnits(process.env.WETH_AMOUNT, 18)
    : wethBalance;
  const minUsdcOut = parseUnits(env("MIN_USDC_OUT"), 6);
  const poolFee = process.env.UNISWAP_POOL_FEE ? Number(process.env.UNISWAP_POOL_FEE) : DEFAULT_UNISWAP_POOL_FEE;
  const deadline = process.env.DEADLINE
    ? BigInt(process.env.DEADLINE)
    : BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
  const resetApprovals = process.env.RESET_APPROVALS !== "false";

  if (amountIn === 0n) throw new Error(`${account.address} has no WETH to swap`);
  if (amountIn > wethBalance) {
    throw new Error(`Requested ${formatUnits(amountIn, 18)} WETH, but wallet only has ${formatUnits(wethBalance, 18)} WETH`);
  }
  if (minUsdcOut === 0n) throw new Error("MIN_USDC_OUT must be nonzero");

  const currentDelegateCode = await publicClient.getCode({ address: account.address });
  if (currentDelegateCode) {
    if (!currentDelegateCode.startsWith("0xef0100")) {
      throw new Error(`${account.address} already has non-7702 contract code; refusing to overwrite assumptions`);
    }
    if (process.env.ALLOW_REDELEGATE !== "true") {
      throw new Error(`${account.address} is already delegated. Set ALLOW_REDELEGATE=true only if you intend to replace it.`);
    }
  }

  const data = encodeFunctionData({
    abi: delegateAbi,
    functionName: "enter",
    args: [amountIn, minUsdcOut, poolFee, deadline, resetApprovals],
  });

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: delegate,
    executor: "self",
  });

  console.log(`account: ${account.address}`);
  console.log(`delegate: ${delegate}`);
  console.log(`delegate runtime code hash: ${delegateCodeHash}`);
  console.log(`swap: ${formatUnits(amountIn, 18)} WETH -> at least ${formatUnits(minUsdcOut, 6)} USDC`);
  console.log(`then: supply exact USDC output to Aave V3 Pool for ${account.address}`);

  const tx = {
    account,
    chain: mainnet,
    to: account.address,
    value: 0n,
    data,
    authorizationList: [authorization],
  } as const;

  const gas = await publicClient.estimateGas(tx);
  console.log(`estimated gas: ${gas}`);

  if (process.env.SEND !== "true") {
    console.log("Dry run only. Set SEND=true to submit the EIP-7702 transaction.");
    return;
  }

  if (process.env.I_UNDERSTAND_THIS_USES_REAL_MAINNET_FUNDS !== "yes") {
    throw new Error("Set I_UNDERSTAND_THIS_USES_REAL_MAINNET_FUNDS=yes to send");
  }

  const hash = await walletClient.sendTransaction({
    ...tx,
    gas: (gas * 120n) / 100n,
  });
  console.log(`tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`status: ${receipt.status}`);
  if (receipt.status !== "success") throw new Error("Transaction reverted");

  const usdcBalance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`remaining USDC balance: ${formatUnits(usdcBalance, 6)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
