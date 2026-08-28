// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Toolshed - non-custodial neighborhood tool lending with USDC deposits
/// @notice Owners list tools and borrowers open loans by escrowing the exact deposit.
contract Toolshed {
    enum LoanStatus { None, Active, Returned, Cancelled }

    struct Tool {
        uint256 id;
        address owner;
        string name;
        string description;
        string imageURI;
        string condition;
        uint96 deposit;
        uint96 dailyLateFee;
        bool active;
    }

    struct Loan {
        uint256 id;
        uint256 toolId;
        address borrower;
        uint64 borrowedAt;
        uint64 dueAt;
        uint64 returnedAt;
        uint96 deposit;
        uint96 lateFeePaid;
        LoanStatus status;
    }

    struct Reputation { uint32 completedLoans; uint32 lateReturns; }

    IERC20 public immutable usdc;
    uint256 public toolCount;
    uint256 public loanCount;
    mapping(uint256 => Tool) public tools;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => uint256) public activeLoanForTool;
    mapping(address => Reputation) public reputation;
    uint256 private locked = 1;

    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
    event ToolUpdated(uint256 indexed toolId, bool active);
    event LoanStarted(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower, uint64 dueAt);
    event LoanReturned(uint256 indexed loanId, uint256 refund, uint256 lateFee, uint256 daysLate);
    event LoanCancelled(uint256 indexed loanId);

    error Unauthorized();
    error InvalidInput();
    error Unavailable();
    error TransferFailed();

    modifier nonReentrant() {
        require(locked == 1, "REENTRANCY");
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert InvalidInput();
        usdc = IERC20(usdc_);
    }

    function listTool(
        string calldata name,
        string calldata description,
        string calldata imageURI,
        string calldata condition,
        uint96 deposit,
        uint96 dailyLateFee
    ) external returns (uint256 id) {
        if (bytes(name).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidInput();
        id = ++toolCount;
        tools[id] = Tool(id, msg.sender, name, description, imageURI, condition, deposit, dailyLateFee, true);
        emit ToolListed(id, msg.sender, name);
    }

    function setToolActive(uint256 toolId, bool active) external {
        Tool storage tool = tools[toolId];
        if (tool.owner != msg.sender) revert Unauthorized();
        if (activeLoanForTool[toolId] != 0) revert Unavailable();
        tool.active = active;
        emit ToolUpdated(toolId, active);
    }

    /// @notice Starts a loan immediately. Approval and physical handoff are coordinated offchain.
    function borrow(uint256 toolId, uint32 durationDays) external nonReentrant returns (uint256 id) {
        Tool storage tool = tools[toolId];
        if (!tool.active || activeLoanForTool[toolId] != 0 || msg.sender == tool.owner) revert Unavailable();
        if (durationDays == 0 || durationDays > 30) revert InvalidInput();
        if (!usdc.transferFrom(msg.sender, address(this), tool.deposit)) revert TransferFailed();

        id = ++loanCount;
        uint64 now_ = uint64(block.timestamp);
        uint64 dueAt = now_ + uint64(durationDays) * 1 days;
        loans[id] = Loan(id, toolId, msg.sender, now_, dueAt, 0, tool.deposit, 0, LoanStatus.Active);
        activeLoanForTool[toolId] = id;
        emit LoanStarted(id, toolId, msg.sender, dueAt);
    }

    /// @notice The owner confirms physical return and settles deposit and late fees.
    function confirmReturn(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        Tool storage tool = tools[loan.toolId];
        if (msg.sender != tool.owner) revert Unauthorized();
        if (loan.status != LoanStatus.Active) revert Unavailable();

        uint256 daysLate = block.timestamp <= loan.dueAt ? 0 : (block.timestamp - loan.dueAt + 1 days - 1) / 1 days;
        uint256 fee = daysLate * uint256(tool.dailyLateFee);
        if (fee > loan.deposit) fee = loan.deposit;
        uint256 refund = uint256(loan.deposit) - fee;

        loan.status = LoanStatus.Returned;
        loan.returnedAt = uint64(block.timestamp);
        loan.lateFeePaid = uint96(fee);
        activeLoanForTool[loan.toolId] = 0;
        Reputation storage rep = reputation[loan.borrower];
        rep.completedLoans++;
        if (daysLate > 0) rep.lateReturns++;

        if (fee > 0 && !usdc.transfer(tool.owner, fee)) revert TransferFailed();
        if (refund > 0 && !usdc.transfer(loan.borrower, refund)) revert TransferFailed();
        emit LoanReturned(loanId, refund, fee, daysLate);
    }

    /// @notice Borrower can unwind before handoff; restricted to the first hour.
    function cancelLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.borrower != msg.sender) revert Unauthorized();
        if (loan.status != LoanStatus.Active || block.timestamp > loan.borrowedAt + 1 hours) revert Unavailable();
        loan.status = LoanStatus.Cancelled;
        activeLoanForTool[loan.toolId] = 0;
        if (!usdc.transfer(loan.borrower, loan.deposit)) revert TransferFailed();
        emit LoanCancelled(loanId);
    }
}

