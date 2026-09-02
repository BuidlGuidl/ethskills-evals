// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IMembershipNFT} from "../interfaces/IMembershipNFT.sol";

/// @notice Stand-in for the DAO's existing membership NFT, so the local deploy has
///         something to point at. In production, delete this and pass the real
///         collection's address to MemberRegistry and AnonymousBallot -- they only
///         ever call `ownerOf`.
/// @dev Non-transferable and mint-only; enough to run the flow, not an ERC-721 to
///      copy into production.
contract MembershipNFT is IMembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable admin;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address) internal _ownerOf;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotAdmin();
    error NoSuchToken();

    constructor(address _admin) {
        admin = _admin;
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        owner = _ownerOf[tokenId];
        if (owner == address(0)) revert NoSuchToken();
    }

    /// @notice Issue membership NFT #`totalSupply` to `to`.
    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != admin) revert NotAdmin();
        tokenId = totalSupply++;
        _ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function mintBatch(address[] calldata recipients) external {
        if (msg.sender != admin) revert NotAdmin();
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 tokenId = totalSupply++;
            _ownerOf[tokenId] = recipients[i];
            balanceOf[recipients[i]] += 1;
            emit Transfer(address(0), recipients[i], tokenId);
        }
    }
}
