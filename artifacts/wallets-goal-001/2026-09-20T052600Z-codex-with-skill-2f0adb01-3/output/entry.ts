import {
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { createPublicClient, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const ADDRESSES = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  UNISWAP_V3_SWAP_ROUTER_02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
  AAVE_V3_POOL_ADDRESSES_PROVIDER: getAddress("0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e"),
  AAVE_V3_POOL: getAddress("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"),

  // ERC-7821 batch executor used as the EIP-7702 delegation target on Ethereum mainnet.
  // Source: Blockdaemon EIP-7702 transaction batching docs.
  ERC7821_BATCHER: getAddress("0xe386b98Cd06c6aee22D66eDF97Df0476e3514222"),
} as const;

const ERC7821_SINGLE_BATCH_MODE =
  "0x0100000000000000000000000000000000000000000000000000000000000000" as const;

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const erc7821BatcherAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "mode", type: "bytes32" },
      { name: "executionData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const oneClickHelperAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "weth", type: "address" },
      { name: "usdc", type: "address" },
      { name: "swapRouter", type: "address" },
      { name: "aavePool", type: "address" },
    ],
  },
  {
    type: "function",
    name: "enter",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "minUsdcOut", type: "uint256" },
      { name: "poolFee", type: "uint24" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "event",
    name: "Entered",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amountIn", type: "uint256" },
      { indexed: false, name: "amountOut", type: "uint256" },
    ],
  },
] as const;

const helperSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
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

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

contract OneClickWethToAaveUsdc {
    address public immutable WETH;
    address public immutable USDC;
    address public immutable SWAP_ROUTER;
    address public immutable AAVE_POOL;

    event Entered(address indexed user, uint256 amountIn, uint256 amountOut);

    constructor(address weth, address usdc, address swapRouter, address aavePool) {
        WETH = weth;
        USDC = usdc;
        SWAP_ROUTER = swapRouter;
        AAVE_POOL = aavePool;
    }

    function enter(uint256 amountIn, uint256 minUsdcOut, uint24 poolFee) external returns (uint256 amountOut) {
        require(amountIn != 0, "ZERO_AMOUNT");
        require(IERC20(WETH).transferFrom(msg.sender, address(this), amountIn), "WETH_TRANSFER_FROM_FAILED");

        _forceApprove(WETH, SWAP_ROUTER, amountIn);
        amountOut = ISwapRouter02(SWAP_ROUTER).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: poolFee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minUsdcOut,
                sqrtPriceLimitX96: 0
            })
        );

        _forceApprove(USDC, AAVE_POOL, amountOut);
        IAaveV3Pool(AAVE_POOL).supply(USDC, amountOut, msg.sender, 0);

        require(IERC20(WETH).balanceOf(address(this)) == 0, "WETH_LEFTOVER");
        require(IERC20(USDC).balanceOf(address(this)) == 0, "USDC_LEFTOVER");
        emit Entered(msg.sender, amountIn, amountOut);
    }

    function _forceApprove(address token, address spender, uint256 amount) private {
        require(IERC20(token).approve(spender, 0), "APPROVE_RESET_FAILED");
        require(IERC20(token).approve(spender, amount), "APPROVE_FAILED");
    }
}
`;

const helperBytecode =
  "0x610100604052348015610010575f5ffd5b506040516109f43803806109f483398101604081905261002f9161006c565b6001600160a01b0393841660805291831660a052821660c0521660e0526100bd565b80516001600160a01b0381168114610067575f5ffd5b919050565b5f5f5f5f6080858703121561007f575f5ffd5b61008885610051565b935061009660208601610051565b92506100a460408601610051565b91506100b260608601610051565b905092959194509250565b60805160a05160c05160e0516108b36101415f395f8181605e01528181610409015261048001525f81816101110152818161027c015261037501525f818160c3015281816102da015281816103e80152818161044501526105af01525f818160ea015281816101980152818161025b015281816102b501526104ea01526108b35ff3fe608060405234801561000f575f5ffd5b5060043610610055575f3560e01c806308a016751461005957806313a51f171461009d57806389a30271146100be578063ad5c4648146100e5578063c60058931461010c575b5f5ffd5b6100807f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b0390911681526020015b60405180910390f35b6100b06100ab366004610803565b610133565b604051908152602001610094565b6100807f000000000000000000000000000000000000000000000000000000000000000081565b6100807f000000000000000000000000000000000000000000000000000000000000000081565b6100807f000000000000000000000000000000000000000000000000000000000000000081565b5f835f036101765760405162461bcd60e51b815260206004820152600b60248201526a16915493d7d05353d5539560aa1b60448201526064015b60405180910390fd5b6040516323b872dd60e01b8152336004820152306024820152604481018590527f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316906323b872dd906064016020604051808303815f875af11580156101e6573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061020a9190610840565b6102565760405162461bcd60e51b815260206004820152601960248201527f574554485f5452414e534645525f46524f4d5f4641494c454400000000000000604482015260640161016d565b6102a17f00000000000000000000000000000000000000000000000000000000000000007f00000000000000000000000000000000000000000000000000000000000000008661069f565b6040805160e0810182526001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000811682527f000000000000000000000000000000000000000000000000000000000000000081166020830190815262ffffff8681168486019081523060608601908152608086018b815260a087018b81525f60c0890190815298516304e45aaf60e01b8152975187166004890152945186166024880152915190921660448601529051831660648501525160848401525160a48301529151821660c48201527f0000000000000000000000000000000000000000000000000000000000000000909116906304e45aaf9060e4016020604051808303815f875af11580156103bd573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103e19190610866565b905061042e7f00000000000000000000000000000000000000000000000000000000000000007f00000000000000000000000000000000000000000000000000000000000000008361069f565b60405163617ba03760e01b81526001600160a01b037f000000000000000000000000000000000000000000000000000000000000000081166004830152602482018390523360448301525f60648301527f0000000000000000000000000000000000000000000000000000000000000000169063617ba037906084015f604051808303815f87803b1580156104c1575f5ffd5b505af11580156104d3573d5f5f3e3d5ffd5b50506040516370a0823160e01b81523060048201527f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031692506370a082319150602401602060405180830381865afa158015610539573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061055d9190610866565b1561059a5760405162461bcd60e51b815260206004820152600d60248201526c2ba2aa242fa622a32a27ab22a960991b604482015260640161016d565b6040516370a0823160e01b81523060048201527f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316906370a0823190602401602060405180830381865afa1580156105fc573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906106209190610866565b1561065d5760405162461bcd60e51b815260206004820152600d60248201526c2aa9a221afa622a32a27ab22a960991b604482015260640161016d565b604080518581526020810183905233917f089d0daa5e8466fdfdab1113e8fdd98c06ef26711cafc429dabce354d007364e910160405180910390a29392505050565b60405163095ea7b360e01b81526001600160a01b0383811660048301525f602483015284169063095ea7b3906044016020604051808303815f875af11580156106ea573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061070e9190610840565b6107515760405162461bcd60e51b81526020600482015260146024820152731054141493d59157d49154d15517d1905253115160621b604482015260640161016d565b60405163095ea7b360e01b81526001600160a01b0383811660048301526024820183905284169063095ea7b3906044016020604051808303815f875af115801561079d573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107c19190610840565b6107fe5760405162461bcd60e51b815260206004820152600e60248201526d1054141493d59157d1905253115160921b604482015260640161016d565b505050565b5f5f5f60608486031215610815575f5ffd5b8335925060208401359150604084013562ffffff81168114610835575f5ffd5b809150509250925092565b5f60208284031215610850575f5ffd5b8151801515811461085f575f5ffd5b9392505050565b5f60208284031215610876575f5ffd5b505191905056fea264697066735822122092ff071e5d0eddaac99d8221bc59df1dbde78e71a7b2ea109ccbbfcc849b8b1d64736f6c63430008250033" as const;

type Clients = ReturnType<typeof makeClients>;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  return value ? getAddress(value) : undefined;
}

function makeClients() {
  const privateKey = env("PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex string with 0x prefix");
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const transport = http(env("RPC_URL"));
  const publicClient = createPublicClient({ chain: mainnet, transport });
  const walletClient = createWalletClient({ account, chain: mainnet, transport });
  return { account, publicClient, walletClient };
}

async function assertMainnet({ publicClient }: Clients) {
  const chainId = await publicClient.getChainId();
  if (chainId !== mainnet.id) throw new Error(`Expected Ethereum mainnet chainId 1, got ${chainId}`);
}

async function assertContract({ publicClient }: Clients, address: Address, label: string) {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") throw new Error(`${label} has no code at ${address}`);
}

async function deployHelper(clients: Clients) {
  const hash = await clients.walletClient.deployContract({
    account: clients.account,
    abi: oneClickHelperAbi,
    bytecode: helperBytecode,
    args: [
      ADDRESSES.WETH,
      ADDRESSES.USDC,
      ADDRESSES.UNISWAP_V3_SWAP_ROUTER_02,
      ADDRESSES.AAVE_V3_POOL,
    ],
  });

  console.log(`helper deploy tx: ${hash}`);
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  console.log(`helper deployed at: ${receipt.contractAddress}`);
}

async function resolveAmountIn(clients: Clients): Promise<bigint> {
  const configured = process.env.AMOUNT_WETH;
  if (configured && configured !== "all") return parseEther(configured);

  const balance = await clients.publicClient.readContract({
    address: ADDRESSES.WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [clients.account.address],
  });
  if (balance === 0n) throw new Error(`No WETH balance at ${clients.account.address}`);
  return balance;
}

function encodeBatch(calls: { to: Address; value: bigint; data: Hex }[]): Hex {
  return encodeAbiParameters(
    [{ type: "tuple(address to,uint256 value,bytes data)[]" }],
    [calls],
  );
}

async function sendOneClickEntry(clients: Clients) {
  const helper = optionalAddress("ONE_CLICK_HELPER");
  if (!helper) {
    throw new Error("Missing ONE_CLICK_HELPER. Deploy the helper once with DEPLOY_HELPER=true, or provide an audited deployed helper address.");
  }

  await assertContract(clients, ADDRESSES.ERC7821_BATCHER, "ERC-7821 batcher");
  await assertContract(clients, helper, "one-click helper");

  const amountIn = await resolveAmountIn(clients);
  const minUsdcOut = parseUnits(env("MIN_USDC_OUT"), 6);
  if (minUsdcOut === 0n) throw new Error("MIN_USDC_OUT must be greater than zero");
  const poolFee = Number(process.env.POOL_FEE ?? "500");
  if (!Number.isInteger(poolFee) || poolFee < 0 || poolFee > 1_000_000) {
    throw new Error("POOL_FEE must be a uint24, for example 500 or 3000");
  }

  const approveWeth = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [helper, amountIn],
  });
  const enter = encodeFunctionData({
    abi: oneClickHelperAbi,
    functionName: "enter",
    args: [amountIn, minUsdcOut, poolFee],
  });
  const executionData = encodeBatch([
    { to: ADDRESSES.WETH, value: 0n, data: approveWeth },
    { to: helper, value: 0n, data: enter },
  ]);
  const data = encodeFunctionData({
    abi: erc7821BatcherAbi,
    functionName: "execute",
    args: [ERC7821_SINGLE_BATCH_MODE, executionData],
  });

  console.log(`account: ${clients.account.address}`);
  console.log(`amount in: ${formatUnits(amountIn, 18)} WETH`);
  console.log(`minimum out: ${formatUnits(minUsdcOut, 6)} USDC`);
  console.log(`Uniswap V3 fee tier: ${poolFee}`);
  console.log(`helper: ${helper}`);
  console.log(`7702 delegation target: ${ADDRESSES.ERC7821_BATCHER}`);

  if (process.env.DRY_RUN === "true") {
    console.log(`to: ${clients.account.address}`);
    console.log(`data: ${data}`);
    return;
  }

  const authorization = await clients.walletClient.signAuthorization({
    account: clients.account,
    contractAddress: ADDRESSES.ERC7821_BATCHER,
    executor: "self",
  });

  const hash = await clients.walletClient.sendTransaction({
    account: clients.account,
    to: clients.account.address,
    data,
    authorizationList: [authorization],
    gas: process.env.GAS_LIMIT ? BigInt(process.env.GAS_LIMIT) : undefined,
  });

  console.log(`entry tx: ${hash}`);
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  console.log(`status: ${receipt.status}`);
  console.log(`gas used: ${receipt.gasUsed}`);
}

async function main() {
  const clients = makeClients();
  await assertMainnet(clients);

  if (process.env.DEPLOY_HELPER === "true") {
    await deployHelper(clients);
    return;
  }

  await sendOneClickEntry(clients);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
