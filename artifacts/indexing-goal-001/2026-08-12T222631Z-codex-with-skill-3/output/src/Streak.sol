// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice One public check-in per address per UTC day.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 280;

    mapping(address member => uint256 utcDay) public lastCheckInDay;

    error AlreadyCheckedIn(uint256 utcDay);
    error NoteTooLong(uint256 length, uint256 maximum);

    /// @dev The indexer treats this event as the canonical history.
    event CheckedIn(address indexed member, uint256 indexed utcDay, string note);

    function checkIn(string calldata note) external {
        uint256 length = bytes(note).length;
        if (length > MAX_NOTE_BYTES) revert NoteTooLong(length, MAX_NOTE_BYTES);

        uint256 utcDay = block.timestamp / 1 days;
        if (lastCheckInDay[msg.sender] == utcDay) revert AlreadyCheckedIn(utcDay);

        lastCheckInDay[msg.sender] = utcDay;
        emit CheckedIn(msg.sender, utcDay, note);
    }
}
