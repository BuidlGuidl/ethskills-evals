// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Stand-in for the DAO's existing membership NFT so the system can run
/// on a local chain. Minimal, non-transferable (soulbound) ERC-721 subset:
/// the voting system only needs `ownerOf` and `balanceOf`.
/// In production, point MemberGroup at the real NFT instead of deploying this.
contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "MEMBER";

    address public immutable admin;
    uint256 public totalSupply;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotAdmin();
    error NonexistentToken();

    constructor(address admin_) {
        admin = admin_;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != admin) revert NotAdmin();
        tokenId = ++totalSupply;
        _owners[tokenId] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NonexistentToken();
    }
}
