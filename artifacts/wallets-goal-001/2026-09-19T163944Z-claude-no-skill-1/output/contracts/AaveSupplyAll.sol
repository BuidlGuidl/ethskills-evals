// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

/// @title AaveSupplyAll
/// @notice Stateless, ownerless utility. Supplies this contract's ENTIRE balance of `asset`
///         to Aave V3 and credits the aTokens to msg.sender.
/// @dev Intended use: inside one atomic batch, a Uniswap swap sends its output here
///      (recipient = this), then the same caller invokes supplyAll(). Nothing can run
///      between those two calls, so the balance is exactly what the swap returned.
///      This contract never holds user approvals and never holds funds between transactions.
///      Anything sent here outside such a batch can be supplied by (and credited to)
///      whoever calls next — do not send tokens here directly.
contract AaveSupplyAll {
    IAavePool public constant POOL = IAavePool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2); // Aave V3 Pool (Ethereum)

    event SuppliedAll(address indexed asset, address indexed onBehalfOf, uint256 amount);

    function supplyAll(address asset, uint256 minAmount) external returns (uint256 amount) {
        amount = IERC20(asset).balanceOf(address(this));
        require(amount != 0 && amount >= minAmount, "AaveSupplyAll: insufficient");
        _approve(asset, amount);
        // aTokens are minted to the caller; the caller cannot redirect them elsewhere.
        POOL.supply(asset, amount, msg.sender, 0);
        emit SuppliedAll(asset, msg.sender, amount);
    }

    /// @dev Tolerates tokens that return no bool. Pool pulls exactly `amount`, so the
    ///      allowance is back to 0 after supply().
    function _approve(address token, uint256 amount) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeCall(IERC20.approve, (address(POOL), amount)));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "AaveSupplyAll: approve failed");
    }
}
