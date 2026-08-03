// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @notice Chainlink price source for the market. One feed per token, prices returned scaled to 1e18 USD.
contract PriceOracle {
    address public owner;

    mapping(address => IAggregatorV3) public feeds;

    error NotOwner();
    error FeedNotSet(address token);

    event FeedUpdated(address indexed token, address feed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeed(address token, IAggregatorV3 feed) external onlyOwner {
        feeds[token] = feed;
        emit FeedUpdated(token, address(feed));
    }

    /// @notice Price of one whole unit of `token` in USD, scaled to 1e18.
    function getPrice(address token) external view returns (uint256) {
        IAggregatorV3 feed = feeds[token];
        if (address(feed) == address(0)) revert FeedNotSet(token);

        int256 answer = feed.latestAnswer();
        return uint256(answer) * 10 ** (18 - feed.decimals());
    }
}
