// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Streak - one public check-in per account per UTC day
/// @notice The event log is the canonical history consumed by the read-side indexer.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 280;

    mapping(address account => uint64 day) public lastCheckInDay;
    mapping(address account => uint256 count) public totalCheckIns;

    event CheckedIn(address indexed account, uint64 indexed day, string note);

    error AlreadyCheckedIn(uint64 day);
    error NoteTooLong(uint256 length);

    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong(bytes(note).length);

        uint64 day = uint64(block.timestamp / 1 days);
        // `totalCheckIns` distinguishes an untouched mapping entry from a genuine
        // check-in on UTC day zero (which is useful on local development chains).
        if (totalCheckIns[msg.sender] != 0 && lastCheckInDay[msg.sender] == day) revert AlreadyCheckedIn(day);

        lastCheckInDay[msg.sender] = day;
        totalCheckIns[msg.sender] += 1;
        emit CheckedIn(msg.sender, day, note);
    }
}
