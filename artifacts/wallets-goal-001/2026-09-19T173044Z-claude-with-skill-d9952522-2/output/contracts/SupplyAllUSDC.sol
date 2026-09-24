// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

interface IAaveV3Pool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @notice Stateless, ownerless helper: supplies this contract's entire USDC balance to
///         Aave V3 on behalf of `onBehalfOf`. It exists only because a static call batch
///         cannot express "supply whatever the previous call returned".
/// @dev    It must never hold USDC between transactions. It is only safe when the USDC
///         arrives and is supplied inside the same atomic batch (swap recipient = this).
contract SupplyAllUSDC {
    IERC20 public constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IAaveV3Pool public constant POOL = IAaveV3Pool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);

    error BelowMinimum(uint256 balance, uint256 minAmount);

    function supplyAll(address onBehalfOf, uint256 minAmount) external returns (uint256 amount) {
        amount = USDC.balanceOf(address(this));
        if (amount < minAmount || amount == 0) revert BelowMinimum(amount, minAmount);
        require(USDC.approve(address(POOL), amount), "approve");
        POOL.supply(address(USDC), amount, onBehalfOf, 0);
    }
}
