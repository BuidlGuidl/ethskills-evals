import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http,
  isAddress,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, mainnet } from "viem/chains";
import {
  getWithdrawals,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
  walletActionsL2,
} from "viem/op-stack";

const CELO_CHAIN_ID = 42220;
const ETHEREUM_CHAIN_ID = 1;
const DEFAULT_TREASURY =
  "0x1111111111111111111111111111111111111111" as const;
const CELO_PORTAL_ADDRESS = "0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC" as const;
const CELO_DISPUTE_GAME_FACTORY_ADDRESS =
  "0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683" as const;
const CELO_L1_STANDARD_BRIDGE_ADDRESS =
  "0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe" as const;

const celoOpStack = defineChain({
  ...celo,
  contracts: {
    ...celo.contracts,
    portal: {
      [ETHEREUM_CHAIN_ID]: {
        address: CELO_PORTAL_ADDRESS,
      },
    },
    disputeGameFactory: {
      [ETHEREUM_CHAIN_ID]: {
        address: CELO_DISPUTE_GAME_FACTORY_ADDRESS,
      },
    },
    l1StandardBridge: {
      [ETHEREUM_CHAIN_ID]: {
        address: CELO_L1_STANDARD_BRIDGE_ADDRESS,
      },
    },
  },
  sourceId: ETHEREUM_CHAIN_ID,
});

type Command = "initiate" | "prove" | "finalize" | "status";

type Options = {
  command: Command;
  amount?: bigint;
  initiateTx?: Hex;
  execute: boolean;
  treasury: Address;
};

function usage(): never {
  throw new Error(
    [
      "Usage:",
      "  npm run sweep -- initiate --amount 123.45 [--treasury 0x...] [--execute]",
      "  npm run sweep -- prove --initiate-tx 0x... [--execute]",
      "  npm run sweep -- finalize --initiate-tx 0x... [--execute]",
      "  npm run sweep -- status --initiate-tx 0x...",
      "",
      "Required env: OPS_PRIVATE_KEY, ETHEREUM_RPC_URL",
      "Optional env: CELO_RPC_URL, TREASURY_ADDRESS",
    ].join("\n"),
  );
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseCommand(value: string | undefined): Command {
  if (
    value === "initiate" ||
    value === "prove" ||
    value === "finalize" ||
    value === "status"
  ) {
    return value;
  }
  usage();
}

function parseAmount(value: string | undefined): bigint | undefined {
  if (!value) return undefined;
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new Error(`Invalid CELO amount "${value}"`);
  }

  const parsed = parseEther(value);
  if (parsed <= 0n) throw new Error("Sweep amount must be greater than 0");
  return parsed;
}

function parseOptions(): Options {
  const command = parseCommand(process.argv[2]);
  const treasuryText =
    getArg("--treasury") ?? process.env.TREASURY_ADDRESS ?? DEFAULT_TREASURY;

  if (!isAddress(treasuryText)) {
    throw new Error(`Invalid treasury address "${treasuryText}"`);
  }

  const initiateTx = getArg("--initiate-tx");
  if (initiateTx && !/^0x[0-9a-fA-F]{64}$/.test(initiateTx)) {
    throw new Error("--initiate-tx must be a transaction hash");
  }

  const options: Options = {
    command,
    amount: parseAmount(getArg("--amount")),
    initiateTx: initiateTx as Hex | undefined,
    execute: process.argv.includes("--execute"),
    treasury: getAddress(treasuryText),
  };

  if (command === "initiate" && options.amount === undefined) {
    throw new Error("initiate requires --amount");
  }
  if (command !== "initiate" && !options.initiateTx) {
    throw new Error(`${command} requires --initiate-tx`);
  }

  return options;
}

function getPrivateKey(): Hex {
  const key = process.env.OPS_PRIVATE_KEY;
  if (!key) throw new Error("Missing OPS_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("OPS_PRIVATE_KEY must be a 0x-prefixed 32-byte private key");
  }
  return key as Hex;
}

async function assertChainIds(l1Client: any, l2Client: any) {
  const [l1ChainId, l2ChainId] = await Promise.all([
    l1Client.getChainId(),
    l2Client.getChainId(),
  ]);

  if (l1ChainId !== ETHEREUM_CHAIN_ID) {
    throw new Error(
      `ETHEREUM_RPC_URL is chain ${l1ChainId}, expected Ethereum mainnet ${ETHEREUM_CHAIN_ID}`,
    );
  }
  if (l2ChainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL is chain ${l2ChainId}, expected Celo ${CELO_CHAIN_ID}`);
  }
}

async function main() {
  const options = parseOptions();
  const account = privateKeyToAccount(getPrivateKey());

  const l1Transport = http(process.env.ETHEREUM_RPC_URL);
  const l2Transport = http(process.env.CELO_RPC_URL);

  const publicClientL1 = createPublicClient({
    chain: mainnet,
    transport: l1Transport,
  }).extend(publicActionsL1());
  const publicClientL2 = createPublicClient({
    chain: celoOpStack,
    transport: l2Transport,
  }).extend(publicActionsL2());
  const walletClientL1 = createWalletClient({
    account,
    chain: mainnet,
    transport: l1Transport,
  }).extend(walletActionsL1());
  const walletClientL2 = createWalletClient({
    account,
    chain: celoOpStack,
    transport: l2Transport,
  }).extend(walletActionsL2());

  await assertChainIds(publicClientL1, publicClientL2);

  console.log(`Mode: ${options.execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Ops wallet: ${account.address}`);
  console.log(`Treasury: ${options.treasury}`);

  if (options.command === "initiate") {
    const amount = options.amount!;
    const l2Balance = await publicClientL2.getBalance({ address: account.address });

    console.log(`Celo CELO balance: ${formatEther(l2Balance)} CELO`);
    console.log(`Sweep amount: ${formatEther(amount)} CELO`);
    if (l2Balance <= amount) {
      throw new Error(
        "Insufficient CELO for sweep amount plus the Celo transaction fee. Leave an ops-wallet gas reserve.",
      );
    }

    const args = await publicClientL1.buildInitiateWithdrawal({
      account,
      to: options.treasury,
      value: amount,
    });

    if (!options.execute) {
      console.log("Initiate withdrawal simulation built successfully.");
      console.log("Dry run complete. Re-run with --execute to broadcast on Celo.");
      return;
    }

    const hash = await walletClientL2.initiateWithdrawal(args);
    console.log(`Initiated withdrawal on Celo: ${hash}`);
    const receipt = await publicClientL2.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Initiate withdrawal failed in tx ${hash}`);
    }
    const [withdrawal] = getWithdrawals(receipt);
    console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`);
    console.log("Next step: run prove with --initiate-tx after getTimeToProve is ready.");
    return;
  }

  const initiateReceipt = await publicClientL2.getTransactionReceipt({
    hash: options.initiateTx!,
  });
  const withdrawals = getWithdrawals(initiateReceipt);
  if (withdrawals.length !== 1) {
    throw new Error(
      `Expected one withdrawal in initiate tx, found ${withdrawals.length}`,
    );
  }
  const withdrawal = withdrawals[0];
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`);

  if (options.command === "status") {
    const status = await publicClientL1.getWithdrawalStatus({
      receipt: initiateReceipt,
      targetChain: celoOpStack,
    });
    console.log(`Withdrawal status: ${status}`);

    try {
      const proveTime = await publicClientL1.getTimeToProve({
        receipt: initiateReceipt,
        targetChain: celoOpStack,
      });
      console.log(
        `Time to prove: ${proveTime.seconds}s, ready at ${new Date(
          Number(proveTime.timestamp) * 1000,
        ).toISOString()}`,
      );
    } catch {
      console.log("Time to prove: already provable or unavailable from RPC");
    }

    try {
      const finalizeTime = await publicClientL1.getTimeToFinalize({
        withdrawalHash: withdrawal.withdrawalHash,
        targetChain: celoOpStack as any,
      });
      console.log(
        `Time to finalize: ${finalizeTime.seconds}s, ready at ${new Date(
          Number(finalizeTime.timestamp) * 1000,
        ).toISOString()}`,
      );
    } catch {
      console.log("Time to finalize: not proved yet, already finalizable, or unavailable from RPC");
    }
    return;
  }

  if (options.command === "prove") {
    const { output, withdrawal: proveWithdrawal } = await publicClientL1.waitToProve({
      receipt: initiateReceipt,
      targetChain: celoOpStack,
    });
    const proveArgs = await publicClientL2.buildProveWithdrawal({
      output,
      withdrawal: proveWithdrawal,
    });

    if (!options.execute) {
      console.log("Prove withdrawal transaction built successfully.");
      console.log("Dry run complete. Re-run with --execute to broadcast on Ethereum.");
      return;
    }

    const hash = await walletClientL1.proveWithdrawal(proveArgs);
    console.log(`Proved withdrawal on Ethereum: ${hash}`);
    const receipt = await publicClientL1.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Prove withdrawal failed in tx ${hash}`);
    }
    console.log("Next step: run finalize after getTimeToFinalize is ready.");
    return;
  }

  await publicClientL1.waitToFinalize({
    targetChain: celoOpStack as any,
    withdrawalHash: withdrawal.withdrawalHash,
  });

  if (!options.execute) {
    console.log("Withdrawal is ready to finalize.");
    console.log("Dry run complete. Re-run with --execute to broadcast on Ethereum.");
    return;
  }

  const hash = await walletClientL1.finalizeWithdrawal({
    targetChain: celoOpStack,
    withdrawal,
  });
  console.log(`Finalized withdrawal on Ethereum: ${hash}`);
  const receipt = await publicClientL1.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Finalize withdrawal failed in tx ${hash}`);
  }
  console.log("Sweep complete. CELO is now released to the mainnet treasury address.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
