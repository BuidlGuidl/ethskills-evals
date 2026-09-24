// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.5.0;

contract DSTest {
    event log(string);
    event logs(bytes);
    event log_address(address);
    event log_bytes32(bytes32);
    event log_int(int256);
    event log_uint(uint256);
    event log_bytes(bytes);
    event log_string(string);
    event log_named_address(string key, address val);
    event log_named_bytes32(string key, bytes32 val);
    event log_named_decimal_int(string key, int256 val, uint256 decimals);
    event log_named_decimal_uint(string key, uint256 val, uint256 decimals);
    event log_named_int(string key, int256 val);
    event log_named_uint(string key, uint256 val);
    event log_named_bytes(string key, bytes val);
    event log_named_string(string key, string val);

    bool public IS_TEST = true;
    bool private _failed;

    function failed() public view returns (bool) {
        return _failed;
    }

    function fail() internal virtual {
        _failed = true;
        assert(false);
    }

    function assertTrue(bool condition) internal virtual {
        if (!condition) {
            emit log("Error: Assertion Failed");
            fail();
        }
    }

    function assertTrue(bool condition, string memory err) internal virtual {
        if (!condition) {
            emit log_named_string("Error", err);
            fail();
        }
    }

    function assertEq(address a, address b) internal virtual {
        if (a != b) {
            emit log("Error: a == b not satisfied [address]");
            emit log_named_address("      Left", a);
            emit log_named_address("     Right", b);
            fail();
        }
    }

    function assertEq(uint256 a, uint256 b) internal virtual {
        if (a != b) {
            emit log("Error: a == b not satisfied [uint]");
            emit log_named_uint("      Left", a);
            emit log_named_uint("     Right", b);
            fail();
        }
    }

    function assertEq(int256 a, int256 b) internal virtual {
        if (a != b) {
            emit log("Error: a == b not satisfied [int]");
            emit log_named_int("      Left", a);
            emit log_named_int("     Right", b);
            fail();
        }
    }

    function assertLe(uint256 a, uint256 b) internal virtual {
        if (a > b) {
            emit log("Error: a <= b not satisfied [uint]");
            emit log_named_uint("      Left", a);
            emit log_named_uint("     Right", b);
            fail();
        }
    }

    function assertEq0(bytes memory a, bytes memory b) internal virtual {
        if (keccak256(a) != keccak256(b)) {
            emit log("Error: a == b not satisfied [bytes]");
            fail();
        }
    }

    function assertEq0(bytes memory a, bytes memory b, string memory err) internal virtual {
        if (keccak256(a) != keccak256(b)) {
            emit log_named_string("Error", err);
            fail();
        }
    }
}
