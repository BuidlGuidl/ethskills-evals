import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ADDRESSES = {
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  uniswapV3SwapRouter02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  aaveV3Pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
} as const satisfies Record<string, Address>;

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

const delegateAbi = [
  {
    type: 'function',
    name: 'enter',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'uniswapPoolFee', type: 'uint24' },
    ],
    outputs: [{ name: 'usdcSupplied', type: 'uint256' }],
  },
  { type: 'receive', stateMutability: 'payable' },
  { type: 'fallback', stateMutability: 'payable' },
  { type: 'error', name: 'OnlySelf', inputs: [] },
  { type: 'error', name: 'WrongChain', inputs: [] },
  { type: 'error', name: 'ZeroAmountIn', inputs: [] },
  { type: 'error', name: 'ZeroUsdcOut', inputs: [] },
  {
    type: 'error',
    name: 'ApproveFailed',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
] as const;

const delegateBytecode =
  '0x608060405234801561000f575f80fd5b506104e68061001d5f395ff3fe60806040526004361061001e575f3560e01c806313a51f171461002757005b3661002557005b005b348015610032575f80fd5b5061004661004136600461040a565b610058565b60405190815260200160405180910390f35b5f3330146100795760405163029a949d60e31b815260040160405180910390fd5b4660011461009a576040516310dfc03360e01b815260040160405180910390fd5b835f036100ba5760405163990965c160e01b815260040160405180910390fd5b6100ed73c02aaa39b223fe8d0a0e5c4f27ead9083c756cc27368b3465833fb72a70ecdf485e0e4c7bd8665fc45866102e7565b6040805160e08101825273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486020820190815262ffffff8581168385019081523060608501908152608085018a815260a086018a81525f60c0880181815298516304e45aaf60e01b815297516001600160a01b0390811660048a015296518716602489015293519094166044870152905184166064860152516084850152905160a484015292511660c48201527368b3465833fb72a70ecdf485e0e4c7bd8665fc45906304e45aaf9060e4016020604051808303815f875af11580156101df573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102039190610447565b9050805f036102255760405163400759af60e01b815260040160405180910390fd5b61025873a0b86991c6218b36c1d19d4a2e9eb0ce3606eb487387870bca3f3fd6335c3f4ce8392d69350b4fa4e2836102e7565b60405163617ba03760e01b815273a0b86991c6218b36c1d19d4a2e9eb0ce3606eb486004820152602481018290523060448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b1580156102c8575f80fd5b505af11580156102da573d5f803e3d5ffd5b5092979650505050505050565b6102f283835f610302565b6102fd838383610302565b505050565b6040516001600160a01b038381166024830152604482018390525f91829186169060640160408051601f198184030181529181526020820180516001600160e01b031663095ea7b360e01b1790525161035b919061045e565b5f604051808303815f865af19150503d805f8114610394576040519150601f19603f3d011682016040523d82523d5f602084013e610399565b606091505b50915091508115806103c757508051158015906103c75750808060200190518101906103c5919061048a565b155b1561040357604051636a93d39160e01b81526001600160a01b038087166004830152851660248201526044810184905260640160405180910390fd5b5050505050565b5f805f6060848603121561041c575f80fd5b8335925060208401359150604084013562ffffff8116811461043c575f80fd5b809150509250925092565b5f60208284031215610457575f80fd5b5051919050565b5f82515f5b8181101561047d5760208186018101518583015201610463565b505f920191825250919050565b5f6020828403121561049a575f80fd5b815180151581146104a9575f80fd5b939250505056fea264697066735822122041f2d67cc47e477772f07c418defe77fe82d70f241c9a614c99bba038a12861e64736f6c63430008140033' as Hex;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function envAddress(name: string): Address | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error(`${name} is not an Ethereum address`);
  return getAddress(value);
}

function envPrivateKey(): Hex {
  const value = env('PRIVATE_KEY');
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('PRIVATE_KEY must be a 32-byte hex string. Do not hardcode it.');
  }
  return value as Hex;
}

function envPoolFee(): number {
  const fee = Number(process.env.UNISWAP_POOL_FEE ?? '500');
  if (!Number.isInteger(fee) || fee < 0 || fee > 0xffffff) {
    throw new Error('UNISWAP_POOL_FEE must fit uint24');
  }
  return fee;
}

async function confirmOrThrow(lines: string[]) {
  if (process.env.YES === 'true') return;

  console.log(lines.join('\n'));
  const rl = createInterface({ input, output });
  const answer = await rl.question('\nType "yes" to send this mainnet transaction: ');
  rl.close();

  if (answer !== 'yes') throw new Error('Aborted');
}

async function deployDelegateImplementation() {
  const rpcUrl = env('MAINNET_RPC_URL');
  const account = privateKeyToAccount(envPrivateKey());
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) });

  console.log(`Deploying WethToAaveUsdc7702 implementation from ${account.address}`);
  const hash = await walletClient.deployContract({
    account,
    abi: delegateAbi,
    bytecode: delegateBytecode,
    chain: mainnet,
  });
  console.log(`Deploy tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error('Deployment receipt had no contract address');

  console.log(`DELEGATE_IMPLEMENTATION=${receipt.contractAddress}`);
}

async function main() {
  if (process.env.DEPLOY_DELEGATE_IMPLEMENTATION === 'true') {
    await deployDelegateImplementation();
    if (process.env.RUN_AFTER_DEPLOY !== 'true') return;
  }

  const delegateImplementation = envAddress('DELEGATE_IMPLEMENTATION');
  if (!delegateImplementation) {
    throw new Error(
      'Set DELEGATE_IMPLEMENTATION to the deployed WethToAaveUsdc7702 implementation, or set DEPLOY_DELEGATE_IMPLEMENTATION=true to deploy it once.',
    );
  }

  const rpcUrl = env('MAINNET_RPC_URL');
  const minUsdcOut = parseUnits(env('MIN_USDC_OUT'), 6);
  const uniswapPoolFee = envPoolFee();
  const account = privateKeyToAccount(envPrivateKey());

  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) });

  const chainId = await publicClient.getChainId();
  if (chainId !== mainnet.id) throw new Error(`RPC is on chain ${chainId}, expected Ethereum mainnet`);

  const delegateCode = await publicClient.getCode({ address: delegateImplementation });
  if (!delegateCode || delegateCode === '0x') {
    throw new Error(`No code found at DELEGATE_IMPLEMENTATION ${delegateImplementation}`);
  }

  const wethBalance = await publicClient.readContract({
    address: ADDRESSES.weth,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  if (wethBalance === 0n) throw new Error(`${account.address} has no WETH`);

  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: delegateImplementation,
    executor: 'self',
  });

  const call = {
    account: account.address,
    address: account.address,
    abi: delegateAbi,
    functionName: 'enter',
    args: [wethBalance, minUsdcOut, uniswapPoolFee],
    authorizationList: [authorization],
  } as const;

  const simulation = await publicClient.simulateContract(call);
  const estimatedGas = await publicClient.estimateContractGas(call);
  const fees = await publicClient.estimateFeesPerGas();
  const maxFeePerGas = fees.maxFeePerGas ?? (await publicClient.getGasPrice());
  const maxNetworkCost = estimatedGas * maxFeePerGas;

  await confirmOrThrow([
    '',
    'Mainnet entry transaction',
    `EOA / Aave recipient: ${account.address}`,
    `7702 delegate implementation: ${delegateImplementation}`,
    `Swap: ${formatEther(wethBalance)} WETH -> USDC on Uniswap V3 fee tier ${uniswapPoolFee}`,
    `Minimum acceptable USDC: ${formatUnits(minUsdcOut, 6)}`,
    `Simulated USDC supplied to Aave: ${formatUnits(simulation.result, 6)}`,
    `Aave V3 Pool: ${ADDRESSES.aaveV3Pool}`,
    `Estimated gas: ${estimatedGas.toString()}`,
    `Max fee per gas used for display: ${formatUnits(maxFeePerGas, 9)} gwei`,
    `Displayed max network cost: ${formatEther(maxNetworkCost)} ETH`,
  ]);

  const hash = await walletClient.writeContract({
    account,
    chain: mainnet,
    address: account.address,
    abi: delegateAbi,
    functionName: 'enter',
    args: [wethBalance, minUsdcOut, uniswapPoolFee],
    authorizationList: [authorization],
  });

  console.log(`Submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  if (process.env.CLEAR_DELEGATION_AFTER === 'true') {
    const clearAuthorization = await walletClient.signAuthorization({
      account,
      contractAddress: zeroAddress,
      executor: 'self',
    });
    const clearHash = await walletClient.sendTransaction({
      account,
      chain: mainnet,
      to: account.address,
      authorizationList: [clearAuthorization],
    });
    console.log(`Submitted delegation clear tx: ${clearHash}`);
    await publicClient.waitForTransactionReceipt({ hash: clearHash });
    console.log('Delegation cleared');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
