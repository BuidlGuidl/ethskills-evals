// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StreakCheckIn
/// @notice Daily check-ins for a Base community. Emits an event-first history for offchain indexing.
contract StreakCheckIn {
    uint256 public constant MAX_NOTE_BYTES = 160;

    mapping(address member => uint256 day) public lastCheckInDay;
    mapping(address member => uint256 count) public totalCheckIns;

    event CheckIn(address indexed member, uint256 indexed day, uint64 timestamp, string note);

    error AlreadyCheckedIn(address member, uint256 day);
    error NoteTooLong(uint256 length, uint256 maxLength);

    function checkIn(string calldata note) external {
        bytes calldata noteBytes = bytes(note);
        if (noteBytes.length > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteBytes.length, MAX_NOTE_BYTES);
        }

        uint256 day = block.timestamp / 1 days;
        if (lastCheckInDay[msg.sender] == day) {
            revert AlreadyCheckedIn(msg.sender, day);
        }

        lastCheckInDay[msg.sender] = day;
        totalCheckIns[msg.sender] += 1;

        emit CheckIn(msg.sender, day, uint64(block.timestamp), note);
    }
}
