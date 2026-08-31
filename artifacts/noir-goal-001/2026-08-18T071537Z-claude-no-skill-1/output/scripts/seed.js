#!/usr/bin/env node
// Demo scaffolding: stand up a crowd of members on a local chain, so a ballot
// has a realistic anonymity set to hide in.
//
// Not part of the system. Real members mint a seat through whatever process the
// DAO already uses, then run scripts/enroll.js themselves.
//
//   COHORT=149 node scripts/seed.js

import { standUpCohort, demoMembers } from "./lib/cohort.js";
import { ANVIL_KEYS, connect, wallet } from "./lib/deployment.js";

const count = Number(process.env.COHORT ?? 149);
const { provider, membership, memberSet } = await connect();
const admin = wallet(process.env.ADMIN_KEY || ANVIL_KEYS.admin, provider);

console.log(`seeding ${count} demo members...`);
await standUpCohort({ provider, membership, memberSet, admin, members: demoMembers(count, provider) });
console.log(`seats issued:     ${await membership.totalSupply()}`);
console.log(`members enrolled: ${await memberSet.memberCount()}`);
console.log(`member set root:  ${await memberSet.root()}`);
