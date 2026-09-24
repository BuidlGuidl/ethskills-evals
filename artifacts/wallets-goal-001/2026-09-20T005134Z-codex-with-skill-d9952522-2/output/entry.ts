import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const MAINNET = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  UNISWAP_V3_SWAP_ROUTER_02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
  UNISWAP_V3_QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
  AAVE_V3_POOL: getAddress("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"),
} as const;

const ENTRY_DELEGATE_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IERC20Like {
    function balanceOf(address owner) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

contract MainnetWethUsdcAaveEntry {
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant SWAP_ROUTER_02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address internal constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    error OnlySelf();
    error WrongChain(uint256 chainId);
    error Expired(uint256 nowTime, uint256 deadline);
    error ZeroAmount();
    error ZeroMinUsdcOut();
    error InsufficientWeth(uint256 balance, uint256 required);
    error BadSwapDelta(uint256 routerAmountOut, uint256 balanceDelta);

    event Entered(uint256 wethIn, uint256 usdcSupplied);

    function enter(uint256 amountIn, uint256 minUsdcOut, uint24 fee, uint256 deadline)
        external
        returns (uint256 usdcSupplied)
    {
        if (msg.sender != address(this)) revert OnlySelf();
        if (block.chainid != 1) revert WrongChain(block.chainid);
        if (block.timestamp > deadline) revert Expired(block.timestamp, deadline);
        if (amountIn == 0) revert ZeroAmount();
        if (minUsdcOut == 0) revert ZeroMinUsdcOut();

        uint256 wethBalance = IERC20Like(WETH).balanceOf(address(this));
        if (wethBalance < amountIn) revert InsufficientWeth(wethBalance, amountIn);

        uint256 usdcBefore = IERC20Like(USDC).balanceOf(address(this));

        _safeApprove(WETH, SWAP_ROUTER_02, amountIn);
        uint256 routerAmountOut = ISwapRouter02(SWAP_ROUTER_02).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: fee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: 0
            })
        );
        _safeApprove(WETH, SWAP_ROUTER_02, 0);

        usdcSupplied = IERC20Like(USDC).balanceOf(address(this)) - usdcBefore;
        if (usdcSupplied != routerAmountOut) revert BadSwapDelta(routerAmountOut, usdcSupplied);

        _safeApprove(USDC, AAVE_V3_POOL, usdcSupplied);
        IAaveV3Pool(AAVE_V3_POOL).supply(USDC, usdcSupplied, address(this), 0);
        _safeApprove(USDC, AAVE_V3_POOL, 0);

        emit Entered(amountIn, usdcSupplied);
    }

    function _safeApprove(address token, address spender, uint256 amount) private {
        (bool ok, bytes memory result) = token.call(abi.encodeCall(IERC20Like.approve, (spender, amount)));
        if (ok && (result.length == 0 || abi.decode(result, (bool)))) return;

        (ok, result) = token.call(abi.encodeCall(IERC20Like.approve, (spender, 0)));
        require(ok && (result.length == 0 || abi.decode(result, (bool))), "APPROVE_ZERO_FAILED");

        (ok, result) = token.call(abi.encodeCall(IERC20Like.approve, (spender, amount)));
        require(ok && (result.length == 0 || abi.decode(result, (bool))), "APPROVE_FAILED");
    }
}`;

const entryDelegateAbi = [
  {
    type: "function",
    name: "enter",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "minUsdcOut", type: "uint256" },
      { name: "fee", type: "uint24" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "usdcSupplied", type: "uint256" }],
  },
] as const;

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

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function mustEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parsePrivateKey(value: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex string with 0x prefix");
  }
  return value as Hex;
}

function parseAddressEnv(name: string): Address {
  return getAddress(mustEnv(name));
}

function parseBool(name: string): boolean {
  return ["1", "true", "yes"].includes((env(name) ?? "").toLowerCase());
}

async function requireTypedConfirmation(prompt: string, expected: string) {
  if (parseBool("SKIP_CLI_CONFIRMATION")) return;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(prompt);
    if (answer.trim() !== expected) throw new Error("Confirmation rejected");
  } finally {
    rl.close();
  }
}

async function compileDelegate() {
  const solcModule = (await import("solc")) as any;
  const solc = solcModule.default ?? solcModule;
  const input = {
    language: "Solidity",
    sources: { "MainnetWethUsdcAaveEntry.sol": { content: ENTRY_DELEGATE_SOURCE } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((error: { severity: string }) => error.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((error: { formattedMessage: string }) => error.formattedMessage).join("\n"));
  }

  const compiled = output.contracts["MainnetWethUsdcAaveEntry.sol"].MainnetWethUsdcAaveEntry;
  return {
    abi: compiled.abi,
    bytecode: `0x${compiled.evm.bytecode.object}` as Hex,
  };
}

async function main() {
  const rpcUrl = mustEnv("MAINNET_RPC_URL");
  const account = privateKeyToAccount(parsePrivateKey(mustEnv("PRIVATE_KEY")));
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) });

  const chainId = await publicClient.getChainId();
  if (chainId !== 1) throw new Error(`RPC is connected to chain ${chainId}, expected Ethereum mainnet chain 1`);

  if (parseBool("DEPLOY_ENTRY_DELEGATE")) {
    const compiled = await compileDelegate();
    console.log("Deploying MainnetWethUsdcAaveEntry implementation...");
    const hash = await walletClient.deployContract({
      account,
      abi: compiled.abi,
      bytecode: compiled.bytecode,
      chain: mainnet,
    } as any);
    console.log(`Deployment transaction: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error("Deployment receipt did not include a contract address");
    const code = await publicClient.getCode({ address: receipt.contractAddress });
    if (!code) throw new Error("No runtime code found after deployment");
    console.log(`ENTRY_DELEGATE_IMPLEMENTATION=${receipt.contractAddress}`);
    console.log(`ENTRY_DELEGATE_CODE_HASH=${keccak256(code)}`);
    return;
  }

  const entryImplementation = parseAddressEnv("ENTRY_DELEGATE_IMPLEMENTATION");
  const implementationCode = await publicClient.getCode({ address: entryImplementation });
  if (!implementationCode) throw new Error(`No contract code at ENTRY_DELEGATE_IMPLEMENTATION ${entryImplementation}`);

  const expectedCodeHash = env("ENTRY_DELEGATE_CODE_HASH")?.toLowerCase();
  const actualCodeHash = keccak256(implementationCode).toLowerCase();
  if (expectedCodeHash && actualCodeHash !== expectedCodeHash) {
    throw new Error(`Delegate code hash mismatch: expected ${expectedCodeHash}, got ${actualCodeHash}`);
  }
  if (parseBool("SEND_TRANSACTION") && !expectedCodeHash) {
    throw new Error("Set ENTRY_DELEGATE_CODE_HASH before SEND_TRANSACTION=true");
  }

  const accountCode = await publicClient.getCode({ address: account.address });
  if (accountCode && !parseBool("ALLOW_EXISTING_ACCOUNT_CODE")) {
    throw new Error(
      `${account.address} already has code/delegation. Set ALLOW_EXISTING_ACCOUNT_CODE=true only after reviewing it.`,
    );
  }

  const fee = Number(env("UNISWAP_V3_FEE") ?? "500");
  if (!Number.isInteger(fee) || fee <= 0 || fee > 1_000_000) throw new Error("UNISWAP_V3_FEE must be a uint24 fee");

  const wethBalance = (await publicClient.readContract({
    address: MAINNET.WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  } as any)) as bigint;
  if (wethBalance === 0n) throw new Error(`${account.address} has no WETH`);

  const amountIn = env("WETH_AMOUNT")
    ? parseUnits(mustEnv("WETH_AMOUNT"), 18)
    : wethBalance;
  if (amountIn > wethBalance) {
    throw new Error(`Requested ${formatUnits(amountIn, 18)} WETH, balance is ${formatUnits(wethBalance, 18)} WETH`);
  }

  const minUsdcOut = env("MIN_USDC_OUT_RAW")
    ? BigInt(mustEnv("MIN_USDC_OUT_RAW"))
    : parseUnits(mustEnv("MIN_USDC_OUT"), 6);
  if (minUsdcOut === 0n) throw new Error("MIN_USDC_OUT must be greater than zero");

  const [routerAllowance, aaveAllowance, quote] = await Promise.all([
    publicClient.readContract({
      address: MAINNET.WETH,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, MAINNET.UNISWAP_V3_SWAP_ROUTER_02],
    } as any) as Promise<bigint>,
    publicClient.readContract({
      address: MAINNET.USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, MAINNET.AAVE_V3_POOL],
    } as any) as Promise<bigint>,
    publicClient
      .simulateContract({
        address: MAINNET.UNISWAP_V3_QUOTER_V2,
        abi: quoterV2Abi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: MAINNET.WETH,
            tokenOut: MAINNET.USDC,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      })
      .then((result) => result.result[0] as bigint)
      .catch(() => undefined),
  ]);

  if ((routerAllowance > 0n || aaveAllowance > 0n) && !parseBool("ALLOW_EXISTING_ALLOWANCES")) {
    throw new Error("Existing WETH router or USDC Aave allowance found; set ALLOW_EXISTING_ALLOWANCES=true after review");
  }

  const deadlineSeconds = BigInt(Number(env("DEADLINE_SECONDS") ?? "600"));
  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadline = now + deadlineSeconds;
  const callData = encodeFunctionData({
    abi: entryDelegateAbi,
    functionName: "enter",
    args: [amountIn, minUsdcOut, fee, deadline],
  });

  console.log("");
  console.log("Mainnet one-click WETH -> USDC -> Aave V3 entry");
  console.log(`Account:                  ${account.address}`);
  console.log(`Delegated implementation: ${entryImplementation}`);
  console.log(`Implementation code hash: ${actualCodeHash}`);
  console.log(`WETH in:                  ${formatUnits(amountIn, 18)} WETH`);
  console.log(`Uniswap V3 fee tier:      ${fee}`);
  if (quote !== undefined) console.log(`Quoter estimate:          ${formatUnits(quote, 6)} USDC`);
  console.log(`Minimum USDC out:         ${formatUnits(minUsdcOut, 6)} USDC`);
  console.log(`Aave V3 Pool:             ${MAINNET.AAVE_V3_POOL}`);
  console.log(`Deadline unix:            ${deadline.toString()}`);
  console.log("");

  await requireTypedConfirmation('Type "enter" to sign the EIP-7702 authorization and prepare this transaction: ', "enter");

  const authorization = await walletClient.signAuthorization({
    account,
    chainId: 1,
    contractAddress: entryImplementation,
    executor: "self",
  });

  const gas = await publicClient.estimateGas({
    account: account.address,
    authorizationList: [authorization],
    data: callData,
    to: account.address,
  } as any);
  const gasPrice = await publicClient.getGasPrice();
  console.log(`Estimated gas:            ${gas.toString()}`);
  console.log(`Estimated gas cost:       ${formatEther(gas * gasPrice)} ETH at ${formatUnits(gasPrice, 9)} gwei`);

  if (!parseBool("SEND_TRANSACTION")) {
    console.log("");
    console.log("Dry run only. Set SEND_TRANSACTION=true to broadcast.");
    return;
  }

  await requireTypedConfirmation('Type "broadcast" to send the atomic mainnet transaction: ', "broadcast");

  const hash = await walletClient.sendTransaction({
    account,
    authorizationList: [authorization],
    data: callData,
    to: account.address,
  } as any);
  console.log(`Submitted transaction: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Status: ${receipt.status}`);
  console.log(`Block:  ${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
