// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title StreakCheckIn
/// @notice A minimal daily onchain check-in contract for a community on Base.
contract StreakCheckIn {
    uint256 public constant MAX_NOTE_BYTES = 160;

    mapping(address member => bool checkedInBefore) public hasCheckedIn;
    mapping(address member => uint256 day) public lastCheckInDay;

    event CheckedIn(
        address indexed member,
        uint256 indexed day,
        uint256 timestamp,
        string note
    );

    error AlreadyCheckedInToday(address member, uint256 day);
    error NoteTooLong(uint256 length, uint256 maxLength);

    function checkIn(string calldata note) external {
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteLength, MAX_NOTE_BYTES);
        }

        uint256 day = block.timestamp / 1 days;
        if (hasCheckedIn[msg.sender] && lastCheckInDay[msg.sender] == day) {
            revert AlreadyCheckedInToday(msg.sender, day);
        }

        hasCheckedIn[msg.sender] = true;
        lastCheckInDay[msg.sender] = day;

        emit CheckedIn(msg.sender, day, block.timestamp, note);
    }
}
