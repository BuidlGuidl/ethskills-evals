// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @notice Stateless, ownerless, immutable helper. It never holds an allowance from anyone.
///         Within one transaction a caller sends tokens here (e.g. as a Uniswap swap recipient)
///         and then calls `supplyAll`, which supplies this contract's ENTIRE balance of `asset`
///         to Aave V3 with aTokens minted to `msg.sender`.
///         Anything left here between transactions is claimable by the next caller, so callers
///         must always deliver and supply in the same atomic batch.
contract SupplyAllToAave {
    /// @dev Aave V3 Pool (Ethereum mainnet, Core market).
    IAaveV3Pool public constant POOL = IAaveV3Pool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);

    event SuppliedAll(address indexed onBehalfOf, address indexed asset, uint256 amount);

    error InsufficientAmount(uint256 amount, uint256 minAmount);
    error ApproveFailed();

    function supplyAll(address asset, uint256 minAmount) external returns (uint256 amount) {
        amount = IERC20(asset).balanceOf(address(this));
        if (amount == 0 || amount < minAmount) revert InsufficientAmount(amount, minAmount);
        if (!IERC20(asset).approve(address(POOL), amount)) revert ApproveFailed();
        POOL.supply(asset, amount, msg.sender, 0);
        emit SuppliedAll(msg.sender, asset, amount);
    }
}
