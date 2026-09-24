// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @notice Stateless, ownerless helper. Supplies this contract's ENTIRE balance of `asset`
///         to Aave V3 on behalf of the caller. Intended to be used as the swap `recipient`
///         inside one atomic batch: swap -> (tokens land here) -> supplyAll() in the same tx.
///         It never holds funds across transactions, has no admin, no upgradability, no storage.
contract SupplyAllToAaveV3 {
    address public constant POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2; // Aave V3 Pool (Ethereum)

    error InsufficientAmount(uint256 amount, uint256 minAmount);
    error ApproveFailed();

    /// @param asset      token to supply (e.g. USDC)
    /// @param minAmount  revert unless at least this much is supplied (slippage guard, in token units)
    /// @return amount    amount supplied; the aTokens are minted to msg.sender
    function supplyAll(address asset, uint256 minAmount) external returns (uint256 amount) {
        amount = IERC20(asset).balanceOf(address(this));
        if (amount == 0 || amount < minAmount) revert InsufficientAmount(amount, minAmount);

        // Exact approval; Aave pulls exactly `amount`, so the allowance returns to 0.
        // Low-level call tolerates tokens that don't return a bool.
        (bool ok, bytes memory ret) = asset.call(abi.encodeWithSelector(0x095ea7b3, POOL, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert ApproveFailed();

        // Credit is always the caller — nobody can redirect someone else's supply.
        IAaveV3Pool(POOL).supply(asset, amount, msg.sender, 0);
    }
}
