// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice ERC-1967 proxy the market is deployed behind. The implementation owns the upgrade entry point.
contract MarketProxy {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    event Upgraded(address indexed implementation);

    constructor(address implementation, bytes memory initData) {
        assembly {
            sstore(IMPLEMENTATION_SLOT, implementation)
        }
        emit Upgraded(implementation);

        if (initData.length > 0) {
            (bool ok, bytes memory ret) = implementation.delegatecall(initData);
            if (!ok) {
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
    }

    fallback() external payable {
        assembly {
            let impl := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
