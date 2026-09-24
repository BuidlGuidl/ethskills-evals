import fs from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const privateKey =
  process.env.PRIVATE_KEY ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function artifact(contractFile, contractName) {
  return JSON.parse(fs.readFileSync(`out/${contractFile}/${contractName}.json`, "utf8"));
}

function linkedBytecode(artifactData, links) {
  let bytecode = artifactData.bytecode.object;
  for (const [sourceName, sourceLinks] of Object.entries(artifactData.bytecode.linkReferences ?? {})) {
    for (const [libraryName, references] of Object.entries(sourceLinks)) {
      const address = links[`${sourceName}:${libraryName}`] ?? links[libraryName];
      if (!address) {
        throw new Error(`missing link address for ${sourceName}:${libraryName}`);
      }

      const addressHex = address.toLowerCase().replace(/^0x/, "");
      for (const reference of references) {
        const start = 2 + reference.start * 2;
        const end = start + reference.length * 2;
        bytecode = `${bytecode.slice(0, start)}${addressHex}${bytecode.slice(end)}`;
      }
    }
  }
  return bytecode;
}

async function deploy(walletClient, publicClient, name, artifactData, args = []) {
  const hash = await walletClient.deployContract({
    abi: artifactData.abi,
    bytecode: artifactData.bytecode.object,
    args,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`${name}: ${receipt.contractAddress}`);
  return receipt.contractAddress;
}

async function main() {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });

  const verifierArtifact = artifact("HonkVerifier.sol", "HonkVerifier");
  const zkTranscriptLibArtifact = artifact("HonkVerifier.sol", "ZKTranscriptLib");
  const relationsLibArtifact = artifact("HonkVerifier.sol", "RelationsLib");
  const membershipArtifact = artifact("DemoMembershipNFT.sol", "DemoMembershipNFT");
  const governanceArtifact = artifact("AnonymousGovernance.sol", "AnonymousGovernance");
  const poseidonArtifact = artifact("PoseidonT3.sol", "PoseidonT3");

  const ZKTranscriptLib = await deploy(
    walletClient,
    publicClient,
    "ZKTranscriptLib",
    zkTranscriptLibArtifact,
  );
  const RelationsLib = await deploy(walletClient, publicClient, "RelationsLib", relationsLibArtifact);
  const linkedVerifierArtifact = {
    ...verifierArtifact,
    bytecode: {
      ...verifierArtifact.bytecode,
      object: linkedBytecode(verifierArtifact, { ZKTranscriptLib, RelationsLib }),
    },
  };
  const HonkVerifier = await deploy(
    walletClient,
    publicClient,
    "HonkVerifier",
    linkedVerifierArtifact,
  );
  const PoseidonT3 = await deploy(walletClient, publicClient, "PoseidonT3", poseidonArtifact);
  const DemoMembershipNFT = await deploy(
    walletClient,
    publicClient,
    "DemoMembershipNFT",
    membershipArtifact,
  );
  const linkedGovernanceArtifact = {
    ...governanceArtifact,
    bytecode: {
      ...governanceArtifact.bytecode,
      object: linkedBytecode(governanceArtifact, { PoseidonT3 }),
    },
  };
  const AnonymousGovernance = await deploy(
    walletClient,
    publicClient,
    "AnonymousGovernance",
    linkedGovernanceArtifact,
    [HonkVerifier, DemoMembershipNFT],
  );

  const chainId = Number(await publicClient.getChainId());
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(
    "deployments/local.json",
    `${JSON.stringify(
      {
        rpcUrl,
        chainId,
        ZKTranscriptLib,
        RelationsLib,
        HonkVerifier,
        PoseidonT3,
        DemoMembershipNFT,
        AnonymousGovernance,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Wrote deployments/local.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
