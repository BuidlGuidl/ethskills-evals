import fs from "fs";
import { deployCore, getWallets } from "./privateVote.mjs";

const { owner } = getWallets();
const { membership, verifier, governor } = await deployCore(owner);

const deployed = {
  membership: await membership.getAddress(),
  verifier: await verifier.getAddress(),
  governor: await governor.getAddress(),
};

fs.writeFileSync("deployed.json", `${JSON.stringify(deployed, null, 2)}\n`);
console.log(JSON.stringify(deployed, null, 2));

