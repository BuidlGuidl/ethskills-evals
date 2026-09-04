// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Stand-in for the DAO's existing membership NFT: a minimal,
///         non-transferable ERC-721. Membership is deliberately public —
///         the privacy in this system comes from the ballot, not from
///         hiding who is allowed to vote.
/// @dev Only the parts the rest of the system touches are implemented
///      (`balanceOf`, `ownerOf`, plus mint/burn for the DAO). If you already
///      have a membership NFT, point MemberRegistry at it instead and delete
///      this file.
contract MembershipNFT {
    string public name;
    string public symbol;
    address public immutable dao;

    mapping(uint256 => address) internal _ownerOf;
    mapping(address => uint256) internal _balanceOf;
    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 indexed id);

    error NotDAO();
    error AlreadyHolder();
    error NotAHolder();
    error NonTransferable();

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        dao = msg.sender;
    }

    modifier onlyDao() {
        _onlyDao();
        _;
    }

    function _onlyDao() internal view {
        if (msg.sender != dao) revert NotDAO();
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balanceOf[owner];
    }

    function ownerOf(uint256 id) external view returns (address) {
        address owner = _ownerOf[id];
        if (owner == address(0)) revert NotAHolder();
        return owner;
    }

    function mint(address to) external onlyDao returns (uint256 id) {
        if (_balanceOf[to] != 0) revert AlreadyHolder();
        id = ++totalSupply;
        _ownerOf[id] = to;
        _balanceOf[to] = 1;
        emit Transfer(address(0), to, id);
    }

    function burn(uint256 id) external onlyDao {
        address owner = _ownerOf[id];
        if (owner == address(0)) revert NotAHolder();
        delete _ownerOf[id];
        _balanceOf[owner] = 0;
        emit Transfer(owner, address(0), id);
    }

    /// @dev Membership is tied to a person, so the token is soulbound.
    function transferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }
}
