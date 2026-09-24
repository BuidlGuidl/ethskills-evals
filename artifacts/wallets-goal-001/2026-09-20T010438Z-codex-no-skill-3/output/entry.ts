import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const ADDRESSES = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  UNISWAP_V3_SWAP_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  AAVE_V3_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
} as const satisfies Record<string, Address>;

const ENTRY_ABI = parseAbi([
  "function enter(uint256 amountIn,uint24 poolFee,uint256 minUsdcOut,uint256 deadline,uint160 sqrtPriceLimitX96) external payable returns (uint256 usdcSupplied)",
]);

const ENTRY_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IERC20Like {
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUniswapV3SwapRouter {
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

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

contract WethUsdcAaveV3Entry7702 {
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant UNISWAP_V3_SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    error OnlySelf();
    error ZeroAmount();
    error DeadlineExpired();
    error InsufficientUsdc(uint256 received, uint256 minimum);
    error TokenCallFailed(address token, bytes data);

    receive() external payable {}

    function enter(
        uint256 amountIn,
        uint24 poolFee,
        uint256 minUsdcOut,
        uint256 deadline,
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256 usdcSupplied) {
        if (msg.sender != address(this)) revert OnlySelf();
        if (amountIn == 0) revert ZeroAmount();
        if (deadline < block.timestamp) revert DeadlineExpired();

        uint256 usdcBefore = IERC20Like(USDC).balanceOf(address(this));

        _forceApprove(WETH, UNISWAP_V3_SWAP_ROUTER, amountIn);
        IUniswapV3SwapRouter(UNISWAP_V3_SWAP_ROUTER).exactInputSingle(
            IUniswapV3SwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: poolFee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        );

        usdcSupplied = IERC20Like(USDC).balanceOf(address(this)) - usdcBefore;
        if (usdcSupplied < minUsdcOut) revert InsufficientUsdc(usdcSupplied, minUsdcOut);

        _forceApprove(USDC, AAVE_V3_POOL, usdcSupplied);
        IAaveV3Pool(AAVE_V3_POOL).supply(USDC, usdcSupplied, address(this), 0);

        _approve(USDC, AAVE_V3_POOL, 0);
        _approve(WETH, UNISWAP_V3_SWAP_ROUTER, 0);
    }

    function _forceApprove(address token, address spender, uint256 amount) private {
        if (IERC20Like(token).allowance(address(this), spender) != 0) {
            _approve(token, spender, 0);
        }
        _approve(token, spender, amount);
    }

    function _approve(address token, address spender, uint256 amount) private {
        bytes memory data = abi.encodeCall(IERC20Like.approve, (spender, amount));
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            revert TokenCallFailed(token, data);
        }
    }
}
`;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  return value ? getAddress(value) : undefined;
}

async function compileEntryImplementation(): Promise<{ abi: typeof ENTRY_ABI; bytecode: Hex }> {
  const { default: solc } = await import("solc");
  const fileName = "WethUsdcAaveV3Entry7702.sol";
  const input = {
    language: "Solidity",
    sources: { [fileName]: { content: ENTRY_SOURCE } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((error: { severity: string }) => error.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((error: { formattedMessage: string }) => error.formattedMessage).join("\n"));
  }

  const bytecode = output.contracts[fileName].WethUsdcAaveV3Entry7702.evm.bytecode.object as string;
  return { abi: ENTRY_ABI, bytecode: `0x${bytecode}` };
}

async function main() {
  const rpcUrl = requiredEnv("RPC_URL");
  const privateKey = requiredEnv("PRIVATE_KEY") as Hex;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) });

  const chainId = await publicClient.getChainId();
  if (chainId !== mainnet.id) throw new Error(`Expected Ethereum mainnet chain id 1, got ${chainId}`);

  let implementation = optionalAddress("ENTRY_IMPLEMENTATION_ADDRESS");
  if (!implementation) {
    if (process.env.DEPLOY_IMPLEMENTATION !== "true") {
      throw new Error(
        "Set ENTRY_IMPLEMENTATION_ADDRESS to a deployed WethUsdcAaveV3Entry7702 implementation, " +
          "or set DEPLOY_IMPLEMENTATION=true to deploy it as setup before the entry transaction.",
      );
    }

    const compiled = await compileEntryImplementation();
    const deployHash = await walletClient.deployContract({
      abi: compiled.abi,
      bytecode: compiled.bytecode,
      account,
      chain: mainnet,
    } as any);
    console.log(`implementation deployment tx: ${deployHash}`);

    const deployment = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    if (!deployment.contractAddress) throw new Error("Implementation deployment did not return a contract address");
    implementation = deployment.contractAddress;
    console.log(`ENTRY_IMPLEMENTATION_ADDRESS=${implementation}`);
  }

  const implementationCode = await publicClient.getCode({ address: implementation });
  if (!implementationCode || implementationCode === "0x") {
    throw new Error(`ENTRY_IMPLEMENTATION_ADDRESS has no code: ${implementation}`);
  }

  const wethBalance = (await publicClient.readContract({
    address: ADDRESSES.WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  } as any)) as bigint;

  const amountIn = process.env.WETH_AMOUNT ? parseUnits(process.env.WETH_AMOUNT, 18) : wethBalance;
  if (amountIn === 0n) throw new Error(`No WETH to swap at ${account.address}`);
  if (amountIn > wethBalance) {
    throw new Error(`Requested ${formatUnits(amountIn, 18)} WETH, but wallet has ${formatUnits(wethBalance, 18)} WETH`);
  }

  const minUsdcOut = parseUnits(requiredEnv("MIN_USDC_OUT"), 6);
  const poolFee = Number(process.env.UNISWAP_POOL_FEE ?? "500");
  const deadlineSeconds = BigInt(Math.floor(Date.now() / 1000) + Number(process.env.SWAP_DEADLINE_SECONDS ?? "600"));
  const sqrtPriceLimitX96 = BigInt(process.env.SQRT_PRICE_LIMIT_X96 ?? "0");

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: implementation,
    executor: "self",
  });

  const data = encodeFunctionData({
    abi: ENTRY_ABI,
    functionName: "enter",
    args: [amountIn, poolFee, minUsdcOut, deadlineSeconds, sqrtPriceLimitX96],
  });

  console.log(`account: ${account.address}`);
  console.log(`delegating to implementation: ${implementation}`);
  console.log(`swapping ${formatUnits(amountIn, 18)} WETH through Uniswap V3 fee tier ${poolFee}`);
  console.log(`minimum USDC to supply: ${formatUnits(minUsdcOut, 6)}`);

  const hash = await walletClient.sendTransaction({
    account,
    to: account.address,
    data,
    authorizationList: [authorization],
  } as any);

  console.log(`entry tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`status: ${receipt.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
