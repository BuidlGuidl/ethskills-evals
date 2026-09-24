// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";

library SafeERC20 {
    function safeTransfer(address token, address to, uint256 amount) internal {
        _call(token, abi.encodeWithSelector(IERC20.transfer.selector, to, amount), "SafeERC20: transfer failed");
    }

    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        _call(
            token,
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount),
            "SafeERC20: transferFrom failed"
        );
    }

    function _call(address token, bytes memory data, string memory errorMessage) private {
        (bool success, bytes memory returnData) = token.call(data);
        require(success, errorMessage);

        if (returnData.length > 0) {
            require(abi.decode(returnData, (bool)), errorMessage);
        }
    }
}

