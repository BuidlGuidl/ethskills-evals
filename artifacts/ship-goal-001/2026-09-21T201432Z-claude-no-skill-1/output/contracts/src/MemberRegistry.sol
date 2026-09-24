// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title MemberRegistry
/// @notice The neighbourhood association's roster plus the borrowing track record of every member.
/// @dev The roster is curated by the association steward (the `owner` of this contract). Track records are
///      written only by authorised ledgers (the Toolshed contract), so members cannot inflate their own.
contract MemberRegistry {
    struct Member {
        bool active;
        uint64 joinedAt;
        uint32 loansBorrowed; // settled loans where this member was the borrower
        uint32 lateReturns; // of those, how many came back after the due date (defaults included)
        uint32 defaults; // tools never returned; the owner claimed the whole deposit
        uint32 loansLent; // settled loans where this member was the tool owner
        string displayName;
    }

    /// @notice Score used for a member with no settled loans yet, in basis points.
    uint16 public constant NEWCOMER_SCORE_BPS = 7500;

    address public steward;
    mapping(address => Member) private _members;
    address[] private _roster;
    mapping(address => bool) public isLedger;

    event StewardTransferred(address indexed previousSteward, address indexed newSteward);
    event MemberAdded(address indexed member, string displayName);
    event MemberDeactivated(address indexed member);
    event MemberReactivated(address indexed member);
    event DisplayNameChanged(address indexed member, string displayName);
    event LedgerSet(address indexed ledger, bool allowed);
    event TrackRecordUpdated(
        address indexed member, uint32 loansBorrowed, uint32 lateReturns, uint32 defaults
    );

    error NotSteward();
    error NotLedger();
    error AlreadyMember();
    error NotAMember();
    error ZeroAddress();

    modifier onlySteward() {
        if (msg.sender != steward) revert NotSteward();
        _;
    }

    modifier onlyLedger() {
        if (!isLedger[msg.sender]) revert NotLedger();
        _;
    }

    constructor(address steward_) {
        if (steward_ == address(0)) revert ZeroAddress();
        steward = steward_;
        emit StewardTransferred(address(0), steward_);
    }

    // --- roster administration -------------------------------------------------

    function transferSteward(address newSteward) external onlySteward {
        if (newSteward == address(0)) revert ZeroAddress();
        emit StewardTransferred(steward, newSteward);
        steward = newSteward;
    }

    function setLedger(address ledger, bool allowed) external onlySteward {
        if (ledger == address(0)) revert ZeroAddress();
        isLedger[ledger] = allowed;
        emit LedgerSet(ledger, allowed);
    }

    function addMember(address member, string calldata displayName) public onlySteward {
        if (member == address(0)) revert ZeroAddress();
        Member storage m = _members[member];
        if (m.joinedAt != 0) {
            // Previously removed: bring them back rather than duplicating the roster entry.
            if (m.active) revert AlreadyMember();
            m.active = true;
            if (bytes(displayName).length != 0) {
                m.displayName = displayName;
                emit DisplayNameChanged(member, displayName);
            }
            emit MemberReactivated(member);
            return;
        }
        m.active = true;
        m.joinedAt = uint64(block.timestamp);
        m.displayName = displayName;
        _roster.push(member);
        emit MemberAdded(member, displayName);
    }

    function addMembers(address[] calldata members, string[] calldata displayNames) external onlySteward {
        require(members.length == displayNames.length, "length mismatch");
        for (uint256 i = 0; i < members.length; i++) {
            addMember(members[i], displayNames[i]);
        }
    }

    function deactivateMember(address member) external onlySteward {
        Member storage m = _members[member];
        if (!m.active) revert NotAMember();
        m.active = false;
        emit MemberDeactivated(member);
    }

    /// @notice Members maintain their own display name.
    function setDisplayName(string calldata displayName) external {
        Member storage m = _members[msg.sender];
        if (!m.active) revert NotAMember();
        m.displayName = displayName;
        emit DisplayNameChanged(msg.sender, displayName);
    }

    // --- track record (ledger only) --------------------------------------------

    /// @notice Record a loan that reached settlement.
    function recordSettledLoan(address borrower, address toolOwner, bool late) external onlyLedger {
        Member storage b = _members[borrower];
        b.loansBorrowed += 1;
        if (late) b.lateReturns += 1;
        _members[toolOwner].loansLent += 1;
        emit TrackRecordUpdated(borrower, b.loansBorrowed, b.lateReturns, b.defaults);
    }

    /// @notice Record a loan whose tool never came back.
    function recordDefault(address borrower, address toolOwner) external onlyLedger {
        Member storage b = _members[borrower];
        b.loansBorrowed += 1;
        b.lateReturns += 1;
        b.defaults += 1;
        _members[toolOwner].loansLent += 1;
        emit TrackRecordUpdated(borrower, b.loansBorrowed, b.lateReturns, b.defaults);
    }

    // --- views -----------------------------------------------------------------

    function isActiveMember(address who) external view returns (bool) {
        return _members[who].active;
    }

    function getMember(address who) external view returns (Member memory) {
        return _members[who];
    }

    function memberCount() external view returns (uint256) {
        return _roster.length;
    }

    /// @notice Page through the roster. The browse screen pulls the whole roster (~300 entries) in one call.
    function getMembers(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addresses, Member[] memory members)
    {
        uint256 total = _roster.length;
        if (offset >= total) return (new address[](0), new Member[](0));
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 n = end - offset;
        addresses = new address[](n);
        members = new Member[](n);
        for (uint256 i = 0; i < n; i++) {
            address who = _roster[offset + i];
            addresses[i] = who;
            members[i] = _members[who];
        }
    }

    /// @notice Share of loans returned on time, in basis points. Newcomers get a neutral starting score.
    function reliabilityBps(address who) public view returns (uint16) {
        Member storage m = _members[who];
        if (m.loansBorrowed == 0) return NEWCOMER_SCORE_BPS;
        uint256 onTime = m.loansBorrowed - m.lateReturns;
        return uint16((onTime * 10_000) / m.loansBorrowed);
    }
}
