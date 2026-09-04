// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice One public check-in per address per UTC day.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 140;

    // day + 1; zero means the address has never checked in.
    mapping(address member => uint256 encodedDay) public lastCheckInDay;
    mapping(address member => uint256 count) public totalCheckIns;

    event CheckedIn(address indexed member, uint256 indexed day, string note);

    error AlreadyCheckedIn(uint256 day);
    error NoteTooLong(uint256 length);

    function checkIn(string calldata note) external {
        uint256 length = bytes(note).length;
        if (length > MAX_NOTE_BYTES) revert NoteTooLong(length);

        uint256 day = block.timestamp / 1 days;
        if (lastCheckInDay[msg.sender] == day + 1) revert AlreadyCheckedIn(day);

        lastCheckInDay[msg.sender] = day + 1;
        unchecked { totalCheckIns[msg.sender]++; }
        emit CheckedIn(msg.sender, day, note);
    }
}
