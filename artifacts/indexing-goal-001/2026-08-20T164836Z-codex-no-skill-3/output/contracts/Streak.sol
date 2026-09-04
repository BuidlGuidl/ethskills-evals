// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice A once-per-UTC-day public community check-in registry.
/// @dev The CheckIn event is the complete, indexable application history.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 280;

    mapping(address member => uint64 day) public lastCheckInDay;

    event CheckIn(
        address indexed member,
        uint64 indexed day,
        uint64 timestamp,
        string note
    );

    error AlreadyCheckedIn(uint64 day);
    error NoteTooLong(uint256 length);

    /// @param note Optional UTF-8 public message, limited by bytes (not characters).
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong(bytes(note).length);

        uint64 day = uint64(block.timestamp / 1 days);
        if (lastCheckInDay[msg.sender] >= day) revert AlreadyCheckedIn(day);

        lastCheckInDay[msg.sender] = day;
        emit CheckIn(msg.sender, day, uint64(block.timestamp), note);
    }
}
