1. Yes. Assuming the authorization tuple in last Tuesday's EIP-7702
   transaction was valid and was processed, the treasury EOA is still delegated
   to `BatchExecutor`.

   Reasoning:

   - EIP-7702 authorization tuples are processed before the execution part of
     the transaction begins.
   - A valid tuple sets the authority account's code to the delegation indicator
     `0xef0100 || delegated_address`.
   - The EIP explicitly makes that delegation persistent. It is not scoped to
     the one transaction.
   - If transaction execution later fails or reverts, the processed delegation
     indicator is not rolled back.
   - You said no later transaction or authorization has been sent from that EOA,
     so nothing has replaced or cleared the delegation.

   Therefore, the failed inner batch call was not a full no-op. The batch's own
   state changes reverted, but the EOA's delegation to `BatchExecutor` remained.

   The on-chain check is `eth_getCode(treasury_eoa)`. If it is still delegated,
   the code should be the 23-byte delegation indicator:

   ```text
   0xef0100<20-byte BatchExecutor address>
   ```

2. To remove the delegation, send another EIP-7702 set-code transaction with a
   fresh valid authorization from the treasury EOA whose delegated `address` is
   the zero address:

   ```text
   authorization = [
     chain_id = 1,
     address  = 0x0000000000000000000000000000000000000000,
     nonce    = <treasury EOA nonce required when the auth tuple is processed>,
     signature by treasury EOA
   ]
   ```

   Under EIP-7702, a valid authorization tuple with `address == 0x0` clears the
   account's delegation indicator and restores the account code hash to the empty
   code hash.

   Important nonce detail:

   - The authorization nonce must equal the treasury EOA's nonce at the moment
     the authorization tuple is processed.
   - EIP-7702 increments the outer transaction sender's nonce before processing
     the authorization list.
   - Therefore, if the treasury EOA itself sends the clearing transaction, and
     its current account nonce before sending is `N`, the clearing authorization
     for that same EOA must normally be signed with nonce `N + 1`.
   - If a separate sponsor/relayer sends the EIP-7702 transaction, the treasury
     EOA is not the outer sender, so the authorization should use the treasury
     EOA's current nonce `N`.

   After the clearing transaction is mined successfully, verify again with
   `eth_getCode(treasury_eoa)`. It should return empty code, normally `0x`.
