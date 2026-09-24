// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Minimal membership NFT used for local deployments. In production
/// AnonVoting is pointed at the DAO's existing membership NFT instead — it only
/// relies on `ownerOf` and `balanceOf`.
contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "MEMBER";

    address public immutable admin;
    uint256 public nextId = 1;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotAdmin();
    error NotOwner();
    error NonexistentToken();

    constructor() {
        admin = msg.sender;
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NonexistentToken();
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != admin) revert NotAdmin();
        tokenId = nextId++;
        _owners[tokenId] = to;
        balanceOf[to]++;
        emit Transfer(address(0), to, tokenId);
    }

    function burn(uint256 tokenId) external {
        if (msg.sender != admin) revert NotAdmin();
        address owner = ownerOf(tokenId);
        delete _owners[tokenId];
        balanceOf[owner]--;
        emit Transfer(owner, address(0), tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        if (msg.sender != from || ownerOf(tokenId) != from) revert NotOwner();
        _owners[tokenId] = to;
        balanceOf[from]--;
        balanceOf[to]++;
        emit Transfer(from, to, tokenId);
    }
}
