// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ApiBilling {
    uint8 public constant HOBBY = 1;
    uint8 public constant PRO = 2;
    uint256 public constant PERIOD = 30 days;
    uint256 public constant MAX_PREPAID_MONTHS = 12;

    address public owner;
    IERC20 public immutable usdc;

    struct Subscription {
        uint8 planId;
        uint64 subscribedUntil;
        uint16 paidPeriods;
        uint256 credit;
    }

    mapping(address => Subscription) private _subs;
    mapping(uint8 => uint256) public planFees;
    uint256 public totalUserFunds;
    uint256 private _reentrancyGuard;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TopUp(address indexed user, uint256 amount, uint256 credited, uint256 credit);
    event Subscribed(address indexed user, uint8 indexed planId, uint256 startsAt);
    event Charged(
        address indexed user,
        uint8 indexed planId,
        uint256 months,
        uint256 feePerMonth,
        uint256 subscribedUntil
    );
    event Lapsed(address indexed user, uint256 subscribedUntil);
    event Cancelled(address indexed user, uint256 refund);
    event Withdrawn(address indexed user, uint256 amount);
    event RevenueWithdrawn(address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error NotOwner();
    error PlanInvalid();
    error AlreadySubscribed();
    error InsufficientCredit();
    error NothingToCancel();
    error InsufficientRevenue();
    error TokenTransferFailed();
    error ReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyGuard != 1) revert ReentrantCall();
        _reentrancyGuard = 2;
        _;
        _reentrancyGuard = 1;
    }

    constructor(address owner_, IERC20 usdc_, uint256 hobbyFee, uint256 proFee) {
        if (owner_ == address(0)) revert ZeroAddress();
        if (address(usdc_) == address(0)) revert ZeroAddress();
        owner = owner_;
        usdc = usdc_;
        planFees[HOBBY] = hobbyFee;
        planFees[PRO] = proFee;
        _reentrancyGuard = 1;
        emit OwnershipTransferred(address(0), owner_);
    }

    function isSubscribed(address user) external view returns (bool) {
        return _subs[user].subscribedUntil > block.timestamp;
    }

    function getSubscription(address user)
        external
        view
        returns (uint8 planId, uint64 subscribedUntil, uint16 paidPeriods, uint256 credit)
    {
        Subscription storage s = _subs[user];
        return (s.planId, s.subscribedUntil, s.paidPeriods, s.credit);
    }

    function revenueAvailable() public view returns (uint256) {
        return usdc.balanceOf(address(this)) - totalUserFunds;
    }

    function topUp(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 balanceBefore = usdc.balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        uint256 credited = usdc.balanceOf(address(this)) - balanceBefore;
        Subscription storage s = _subs[msg.sender];
        s.credit += credited;
        totalUserFunds += credited;
        _settle(msg.sender);
        emit TopUp(msg.sender, amount, credited, s.credit);
    }

    function subscribe(uint8 planId) external nonReentrant {
        uint256 fee = planFees[planId];
        if (fee == 0) revert PlanInvalid();
        Subscription storage s = _subs[msg.sender];
        _processLapse(msg.sender, s);
        if (s.subscribedUntil > block.timestamp) revert AlreadySubscribed();
        if (s.credit < fee) revert InsufficientCredit();
        s.planId = planId;
        s.subscribedUntil = uint64(block.timestamp);
        emit Subscribed(msg.sender, planId, block.timestamp);
        _charge(msg.sender, s, fee);
    }

    function cancel() external nonReentrant {
        Subscription storage s = _subs[msg.sender];
        _processLapse(msg.sender, s);
        if (s.planId == 0 && s.credit == 0) revert NothingToCancel();
        uint256 refund = s.credit;
        if (s.subscribedUntil > block.timestamp) {
            uint256 fee = planFees[s.planId];
            refund += (fee * (uint256(s.subscribedUntil) - block.timestamp)) / PERIOD;
            totalUserFunds -= uint256(s.paidPeriods) * fee;
        }
        totalUserFunds -= s.credit;
        delete _subs[msg.sender];
        _safeTransfer(msg.sender, refund);
        emit Cancelled(msg.sender, refund);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Subscription storage s = _subs[msg.sender];
        _processLapse(msg.sender, s);
        if (s.credit < amount) revert InsufficientCredit();
        s.credit -= amount;
        totalUserFunds -= amount;
        _safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function settle(address user) external {
        _settle(user);
    }

    function settleMany(address[] calldata users) external {
        for (uint256 i = 0; i < users.length; i++) {
            _settle(users[i]);
        }
    }

    function withdrawRevenue(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > revenueAvailable()) revert InsufficientRevenue();
        _safeTransfer(to, amount);
        emit RevenueWithdrawn(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function _settle(address user) internal {
        Subscription storage s = _subs[user];
        _processLapse(user, s);
        if (s.subscribedUntil > block.timestamp) {
            _charge(user, s, planFees[s.planId]);
        }
    }

    function _processLapse(address user, Subscription storage s) internal {
        if (s.paidPeriods > 0 && s.subscribedUntil <= block.timestamp) {
            totalUserFunds -= uint256(s.paidPeriods) * planFees[s.planId];
            emit Lapsed(user, s.subscribedUntil);
            s.paidPeriods = 0;
        }
    }

    function _charge(address user, Subscription storage s, uint256 fee) internal {
        uint256 horizon = block.timestamp + MAX_PREPAID_MONTHS * PERIOD;
        uint256 months = 0;
        while (s.credit >= fee && s.subscribedUntil + PERIOD <= horizon) {
            s.credit -= fee;
            s.paidPeriods += 1;
            s.subscribedUntil += uint64(PERIOD);
            months += 1;
        }
        if (months > 0) {
            emit Charged(user, s.planId, months, fee, s.subscribedUntil);
        }
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, bytes memory ret) = address(usdc).call(
            abi.encodeCall(IERC20.transfer, (to, amount))
        );
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory ret) = address(usdc).call(
            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
        );
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TokenTransferFailed();
    }
}
