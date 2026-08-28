// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Toolshed
/// @notice Member-only tool listings and USDC-secured neighborhood loans.
contract Toolshed {
    enum LoanStatus { None, Requested, Active, Returned, Completed, Rejected, Cancelled }

    struct Tool {
        uint256 id;
        address owner;
        string name;
        string description;
        string imageURI;
        string condition;
        uint256 deposit;
        uint256 dailyLateFee;
        bool available;
    }

    struct Loan {
        uint256 id;
        uint256 toolId;
        address borrower;
        uint64 durationDays;
        uint64 dueAt;
        uint64 returnedAt;
        LoanStatus status;
    }

    struct Reputation { uint32 completedLoans; uint32 lateReturns; }

    IERC20 public immutable usdc;
    address public admin;
    uint256 public toolCount;
    uint256 public loanCount;
    mapping(address => bool) public isMember;
    mapping(uint256 => Tool) public tools;
    mapping(uint256 => Loan) public loans;
    mapping(address => Reputation) public reputation;

    event MemberSet(address indexed member, bool active);
    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
    event ToolUpdated(uint256 indexed toolId);
    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
    event LoanStatusChanged(uint256 indexed loanId, LoanStatus status);
    event LoanSettled(uint256 indexed loanId, uint256 refund, uint256 lateFee);

    error Unauthorized();
    error InvalidState();
    error InvalidInput();
    error TransferFailed();

    modifier onlyAdmin() { if (msg.sender != admin) revert Unauthorized(); _; }
    modifier onlyMember() { if (!isMember[msg.sender]) revert Unauthorized(); _; }

    constructor(address usdc_, address admin_) {
        if (usdc_ == address(0) || admin_ == address(0)) revert InvalidInput();
        usdc = IERC20(usdc_);
        admin = admin_;
        isMember[admin_] = true;
        emit MemberSet(admin_, true);
    }

    function setMember(address member, bool active) external onlyAdmin {
        if (member == address(0)) revert InvalidInput();
        isMember[member] = active;
        emit MemberSet(member, active);
    }

    function transferAdmin(address nextAdmin) external onlyAdmin {
        if (nextAdmin == address(0)) revert InvalidInput();
        admin = nextAdmin;
        isMember[nextAdmin] = true;
        emit MemberSet(nextAdmin, true);
    }

    function listTool(
        string calldata name,
        string calldata description,
        string calldata imageURI,
        string calldata condition,
        uint256 deposit,
        uint256 dailyLateFee
    ) external onlyMember returns (uint256 toolId) {
        if (bytes(name).length == 0 || deposit == 0 || dailyLateFee > deposit) revert InvalidInput();
        toolId = ++toolCount;
        tools[toolId] = Tool(toolId, msg.sender, name, description, imageURI, condition, deposit, dailyLateFee, true);
        emit ToolListed(toolId, msg.sender, name);
    }

    function setToolAvailability(uint256 toolId, bool available) external {
        Tool storage tool = tools[toolId];
        if (tool.owner != msg.sender) revert Unauthorized();
        tool.available = available;
        emit ToolUpdated(toolId);
    }

    function requestLoan(uint256 toolId, uint64 durationDays) external onlyMember returns (uint256 loanId) {
        Tool storage tool = tools[toolId];
        if (!tool.available || tool.owner == address(0) || tool.owner == msg.sender || durationDays == 0 || durationDays > 30) revert InvalidInput();
        if (!usdc.transferFrom(msg.sender, address(this), tool.deposit)) revert TransferFailed();
        loanId = ++loanCount;
        loans[loanId] = Loan(loanId, toolId, msg.sender, durationDays, 0, 0, LoanStatus.Requested);
        emit LoanRequested(loanId, toolId, msg.sender);
    }

    function acceptLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        Tool storage tool = tools[loan.toolId];
        if (tool.owner != msg.sender) revert Unauthorized();
        if (loan.status != LoanStatus.Requested || !tool.available) revert InvalidState();
        loan.status = LoanStatus.Active;
        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * 1 days);
        tool.available = false;
        emit LoanStatusChanged(loanId, LoanStatus.Active);
    }

    function rejectLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        Tool storage tool = tools[loan.toolId];
        if (tool.owner != msg.sender) revert Unauthorized();
        if (loan.status != LoanStatus.Requested) revert InvalidState();
        loan.status = LoanStatus.Rejected;
        if (!usdc.transfer(loan.borrower, tool.deposit)) revert TransferFailed();
        emit LoanStatusChanged(loanId, LoanStatus.Rejected);
    }

    function cancelRequest(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        Tool storage tool = tools[loan.toolId];
        if (loan.borrower != msg.sender) revert Unauthorized();
        if (loan.status != LoanStatus.Requested) revert InvalidState();
        loan.status = LoanStatus.Cancelled;
        if (!usdc.transfer(loan.borrower, tool.deposit)) revert TransferFailed();
        emit LoanStatusChanged(loanId, LoanStatus.Cancelled);
    }

    function markReturned(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.borrower != msg.sender) revert Unauthorized();
        if (loan.status != LoanStatus.Active) revert InvalidState();
        loan.status = LoanStatus.Returned;
        loan.returnedAt = uint64(block.timestamp);
        emit LoanStatusChanged(loanId, LoanStatus.Returned);
    }

    function confirmReturn(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        Tool storage tool = tools[loan.toolId];
        if (tool.owner != msg.sender) revert Unauthorized();
        if (loan.status != LoanStatus.Returned) revert InvalidState();

        uint256 lateDays;
        if (loan.returnedAt > loan.dueAt) lateDays = (uint256(loan.returnedAt - loan.dueAt) + 1 days - 1) / 1 days;
        uint256 fee = lateDays * tool.dailyLateFee;
        if (fee > tool.deposit) fee = tool.deposit;
        uint256 refund = tool.deposit - fee;

        loan.status = LoanStatus.Completed;
        tool.available = true;
        Reputation storage rep = reputation[loan.borrower];
        rep.completedLoans += 1;
        if (lateDays > 0) rep.lateReturns += 1;

        if (fee > 0 && !usdc.transfer(tool.owner, fee)) revert TransferFailed();
        if (refund > 0 && !usdc.transfer(loan.borrower, refund)) revert TransferFailed();
        emit LoanSettled(loanId, refund, fee);
        emit LoanStatusChanged(loanId, LoanStatus.Completed);
    }
}

