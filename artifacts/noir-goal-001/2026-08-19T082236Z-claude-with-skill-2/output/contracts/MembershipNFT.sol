// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The DAO's public membership badge. One non-transferable token per member.
/// @dev Deliberately minimal — membership is public by design, so this contract carries
///      no privacy weight. It exists so VoterRegistry has an onchain source of truth for
///      "is this wallet a member, and has this membership already been used to join?".
///      Non-transferable because a transferable badge would let one person collect several
///      badges and cast several ballots.
contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable admin;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address) public ownerOf;
    mapping(address member => uint256) public tokenOf; // 0 = not a member

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotAdmin();
    error AlreadyMember();
    error ZeroAddress();

    constructor(address admin_) {
        admin = admin_;
    }

    /// @notice Mint a membership badge. tokenIds start at 1 so `tokenOf` can use 0 as "none".
    function mint(address member) external returns (uint256 tokenId) {
        if (msg.sender != admin) revert NotAdmin();
        if (member == address(0)) revert ZeroAddress();
        if (tokenOf[member] != 0) revert AlreadyMember();

        tokenId = ++totalSupply;
        ownerOf[tokenId] = member;
        tokenOf[member] = tokenId;
        emit Transfer(address(0), member, tokenId);
    }

    function balanceOf(address member) external view returns (uint256) {
        return tokenOf[member] == 0 ? 0 : 1;
    }
}
