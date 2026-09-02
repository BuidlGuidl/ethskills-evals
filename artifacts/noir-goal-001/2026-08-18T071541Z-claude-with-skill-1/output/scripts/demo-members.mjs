import { identityFromSeed, seedFromPhrase } from "./lib/identity.mjs";

/// The local chain pretends to be a 150-member DAO. Member i holds membership NFT id i+1 and is
/// the (i+1)-th account of the standard anvil mnemonic.
export const MEMBER_COUNT = 150;
export const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

/// Deployer is anvil account 0; members are accounts 1..150; account 151 relays ballots.
export const memberAccountIndex = (i) => i + 1;
export const RELAYER_ACCOUNT_INDEX = MEMBER_COUNT + 1;
export const derivationPath = (i) => `m/44'/60'/0'/0/${i}`;

/**
 * Demo-only stand-in for `identityFromWallet`. Real members derive their seed by signing
 * `IDENTITY_MESSAGE`; a passphrase this guessable would let anyone recompute their commitment —
 * which does not break the tally, but does let an observer link them to their nullifier hash and
 * so to their ballot. The fixture generator and the Foundry test need a seed both languages can
 * reproduce without a signer, which is the only reason it exists.
 */
export const demoSeed = (i) => seedFromPhrase(`dao-demo-member-${i}`);
export const demoIdentity = (i) => identityFromSeed(demoSeed(i));
