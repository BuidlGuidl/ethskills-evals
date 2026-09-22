// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";

library SafeERC20 {
    error SafeERC20CallFailed();

    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(token.transfer, (to, amount)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(token.transferFrom, (from, to, amount)));
    }

    function safeApprove(IERC20 token, address spender, uint256 amount) internal {
        _call(token, abi.encodeCall(token.approve, (spender, amount)));
    }

    function forceApprove(IERC20 token, address spender, uint256 amount) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(token.approve, (spender, amount)));
        if (ok && (data.length == 0 || abi.decode(data, (bool)))) return;

        _call(token, abi.encodeCall(token.approve, (spender, 0)));
        _call(token, abi.encodeCall(token.approve, (spender, amount)));
    }

    function _call(IERC20 token, bytes memory callData) private {
        (bool ok, bytes memory data) = address(token).call(callData);
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeERC20CallFailed();
    }
}

