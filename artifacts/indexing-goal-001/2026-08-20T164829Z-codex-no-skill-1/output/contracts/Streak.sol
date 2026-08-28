// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice One check-in per UTC calendar day. Events are the canonical public history.
contract Streak {
    error AlreadyCheckedInToday();
    error NoteTooLong();

    uint256 public constant MAX_NOTE_BYTES = 280;
    mapping(address => uint64) public lastCheckInDay;
    mapping(address => uint256) public totalCheckIns;

    event CheckedIn(address indexed member, uint64 indexed day, string note);

    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong();

        uint64 day = uint64(block.timestamp / 1 days);
        if (lastCheckInDay[msg.sender] == day) revert AlreadyCheckedInToday();

        lastCheckInDay[msg.sender] = day;
        unchecked { totalCheckIns[msg.sender]++; }
        emit CheckedIn(msg.sender, day, note);
    }
}
