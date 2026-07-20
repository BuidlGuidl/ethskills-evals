import { deployScript, artifacts } from "../rocketh/deploy.js";

// USDC on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Deploys the Payouts contract pointed at Base USDC.
 *
 * @param env Rocketh environment object.
 */
export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    await env.deploy("Payouts", {
      account: deployer,
      artifact: artifacts.Payouts,
      // Contract constructor arguments
      args: [USDC_ADDRESS],
    });
  },
  {
    // Tags are useful if you have multiple deploy files and only want to run some of them.
    // e.g. yarn deploy --tags Payouts
    tags: ["Payouts"],
  },
);
