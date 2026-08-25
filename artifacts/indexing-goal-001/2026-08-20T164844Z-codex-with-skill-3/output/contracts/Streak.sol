// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice One daily UTC check-in per address. The event is the canonical read model input.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 280;

    struct Member {
        uint64 lastDay;
        uint64 currentStreak;
        uint64 totalCheckIns;
    }

    mapping(address => Member) public members;

    event CheckedIn(
        address indexed member,
        uint64 indexed day,
        uint64 timestamp,
        uint64 currentStreak,
        uint64 totalCheckIns,
        string note
    );

    error AlreadyCheckedIn(uint64 day);
    error NoteTooLong(uint256 length);

    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong(bytes(note).length);

        uint64 day = uint64(block.timestamp / 1 days);
        Member storage member = members[msg.sender];
        if (member.lastDay == day) revert AlreadyCheckedIn(day);

        member.currentStreak = member.lastDay + 1 == day ? member.currentStreak + 1 : 1;
        member.lastDay = day;
        member.totalCheckIns += 1;

        emit CheckedIn(msg.sender, day, uint64(block.timestamp), member.currentStreak, member.totalCheckIns, note);
    }
}
