// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice One UTC-day check-in per address. History is intentionally emitted as events.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 280;

    mapping(address member => uint64 day) public lastCheckedInDay;

    event CheckedIn(address indexed member, uint64 indexed day, uint64 checkedInAt, string note);

    error AlreadyCheckedIn(uint64 day);
    error NoteTooLong(uint256 length);

    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong(bytes(note).length);

        uint64 day = uint64(block.timestamp / 1 days);
        if (lastCheckedInDay[msg.sender] == day) revert AlreadyCheckedIn(day);

        lastCheckedInDay[msg.sender] = day;
        emit CheckedIn(msg.sender, day, uint64(block.timestamp), note);
    }
}
