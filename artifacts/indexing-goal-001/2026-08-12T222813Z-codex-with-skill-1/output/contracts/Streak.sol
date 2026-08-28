// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice One UTC-day check-in per address. Historical reads come from CheckIn events.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 280;

    error AlreadyCheckedIn(uint256 day);
    error NoteTooLong(uint256 length);

    event CheckedIn(address indexed member, uint256 indexed day, uint256 timestamp, string note);

    mapping(address member => uint256 dayPlusOne) private lastCheckInDayPlusOne;

    function checkIn(string calldata note) external {
        uint256 day = block.timestamp / 1 days;
        if (lastCheckInDayPlusOne[msg.sender] == day + 1) revert AlreadyCheckedIn(day);
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong(bytes(note).length);

        lastCheckInDayPlusOne[msg.sender] = day + 1;
        emit CheckedIn(msg.sender, day, block.timestamp, note);
    }

    function hasCheckedInToday(address member) external view returns (bool) {
        return lastCheckInDayPlusOne[member] == block.timestamp / 1 days + 1;
    }
}
