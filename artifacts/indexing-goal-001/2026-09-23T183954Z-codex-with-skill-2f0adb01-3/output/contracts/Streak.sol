// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice One-write-per-day community check-in contract.
/// @dev The event is the product API. Notes are emitted, not stored, so history is
/// reconstructed by the read-side indexer from logs starting at deployment.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 160;

    uint256 public checkInCount;

    mapping(address member => bool checkedInBefore) public hasCheckedIn;
    mapping(address member => uint64 day) public lastCheckInDay;
    mapping(address member => uint256 total) public totalCheckIns;

    event CheckedIn(
        address indexed member, uint64 indexed day, uint256 indexed checkInId, string note
    );

    error AlreadyCheckedIn(address member, uint64 day);
    error NoteTooLong(uint256 length, uint256 maxLength);

    function checkIn(string calldata note) external returns (uint256 checkInId) {
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteLength, MAX_NOTE_BYTES);
        }

        uint64 day = currentDay();
        if (hasCheckedIn[msg.sender] && lastCheckInDay[msg.sender] == day) {
            revert AlreadyCheckedIn(msg.sender, day);
        }

        hasCheckedIn[msg.sender] = true;
        lastCheckInDay[msg.sender] = day;
        totalCheckIns[msg.sender] += 1;

        checkInId = ++checkInCount;
        emit CheckedIn(msg.sender, day, checkInId, note);
    }

    function currentDay() public view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }
}
