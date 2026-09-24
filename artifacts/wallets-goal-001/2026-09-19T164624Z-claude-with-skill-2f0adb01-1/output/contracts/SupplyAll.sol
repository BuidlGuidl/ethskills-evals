// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @notice Stateless helper: supplies the caller's ENTIRE balance of `asset` to Aave V3,
///         crediting the aTokens to the caller.
/// @dev    It only ever pulls from `msg.sender` and only ever supplies on behalf of `msg.sender`,
///         so an allowance granted to it cannot be used by anyone else to move your tokens.
///         No owner, no storage, no upgradeability, holds nothing between calls.
///         Exists because Aave V3 `supply` has no "use my whole balance" sentinel, and a batched
///         call list is static calldata — it cannot forward a swap's runtime output by itself.
contract SupplyAll {
    IAavePool public constant POOL = IAavePool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);

    error BelowMinimum(uint256 amount, uint256 minAmount);
    error TokenCallFailed();

    /// @return amount the amount supplied (the caller's full balance at call time)
    function supplyAll(address asset, uint256 minAmount) external returns (uint256 amount) {
        amount = IERC20Min(asset).balanceOf(msg.sender);
        if (amount < minAmount || amount == 0) revert BelowMinimum(amount, minAmount);

        _call(asset, abi.encodeCall(IERC20Min.transferFrom, (msg.sender, address(this), amount)));
        _call(asset, abi.encodeCall(IERC20Min.approve, (address(POOL), amount)));
        POOL.supply(asset, amount, msg.sender, 0);
    }

    function _call(address token, bytes memory data) private {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool))) || token.code.length == 0) {
            revert TokenCallFailed();
        }
    }
}

interface IERC20Min {
    function balanceOf(address) external view returns (uint256);
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}
