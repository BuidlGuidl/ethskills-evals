// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title Toolshed - member-to-member tool lending with USDC escrow
contract Toolshed {
    uint256 public constant DAY = 1 days;
    uint256 public constant OWNER_RESPONSE_WINDOW = 3 days;

    enum LoanStatus {
        None,
        Requested,
        Active,
        ReturnMarked,
        Complete,
        Rejected,
        Cancelled
    }

    struct Tool {
        uint256 id;
        address owner;
        string name;
        string photoURI;
        string condition;
        uint256 deposit;
        uint256 dailyLateFee;
        bool available;
        bool active;
    }

    struct Loan {
        uint256 id;
        uint256 toolId;
        address borrower;
        uint32 durationDays;
        uint64 startedAt;
        uint64 dueAt;
        uint64 returnMarkedAt;
        LoanStatus status;
    }

    struct Reputation {
        uint32 completedLoans;
        uint32 lateReturns;
    }

    address public immutable admin;
    IERC20 public immutable usdc;
    uint256 public toolCount;
    uint256 public loanCount;
    mapping(address => bool) public members;
    mapping(uint256 => Tool) public tools;
    mapping(uint256 => Loan) public loans;
    mapping(address => Reputation) public reputation;
    mapping(uint256 => uint256[]) private _toolLoans;
    uint256 private _locked = 1;

    event MemberSet(address indexed member, bool enabled);
    event ToolListed(uint256 indexed toolId, address indexed owner, string name);
    event ToolUpdated(uint256 indexed toolId);
    event LoanRequested(uint256 indexed loanId, uint256 indexed toolId, address indexed borrower);
    event LoanStarted(uint256 indexed loanId, uint64 dueAt);
    event ReturnMarked(uint256 indexed loanId, uint64 markedAt);
    event LoanSettled(uint256 indexed loanId, uint256 ownerFee, uint256 borrowerRefund, bool late);
    event LoanClosed(uint256 indexed loanId, LoanStatus status);

    modifier onlyAdmin() {
        require(msg.sender == admin, "admin only");
        _;
    }
    modifier onlyMember() {
        require(members[msg.sender], "members only");
        _;
    }
    modifier nonReentrant() {
        require(_locked == 1, "reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address usdcAddress) {
        require(usdcAddress != address(0), "zero USDC");
        admin = msg.sender;
        usdc = IERC20(usdcAddress);
        members[msg.sender] = true;
        emit MemberSet(msg.sender, true);
    }

    function setMember(address member, bool enabled) external onlyAdmin {
        require(member != address(0), "zero member");
        members[member] = enabled;
        emit MemberSet(member, enabled);
    }

    function listTool(
        string calldata name,
        string calldata photoURI,
        string calldata condition,
        uint256 deposit,
        uint256 dailyLateFee
    ) external onlyMember returns (uint256 id) {
        require(bytes(name).length > 0, "name required");
        require(deposit > 0, "deposit required");
        require(dailyLateFee <= deposit, "fee exceeds deposit");
        id = ++toolCount;
        tools[id] = Tool(id, msg.sender, name, photoURI, condition, deposit, dailyLateFee, true, true);
        emit ToolListed(id, msg.sender, name);
    }

    function updateTool(
        uint256 id,
        string calldata photoURI,
        string calldata condition,
        uint256 deposit,
        uint256 dailyLateFee,
        bool active
    ) external {
        Tool storage tool = tools[id];
        require(tool.owner == msg.sender, "owner only");
        require(tool.available, "loan pending");
        require(deposit > 0 && dailyLateFee <= deposit, "bad terms");
        tool.photoURI = photoURI;
        tool.condition = condition;
        tool.deposit = deposit;
        tool.dailyLateFee = dailyLateFee;
        tool.active = active;
        tool.available = active;
        emit ToolUpdated(id);
    }

    function requestLoan(uint256 toolId, uint32 durationDays) external onlyMember nonReentrant returns (uint256 id) {
        Tool storage tool = tools[toolId];
        require(tool.active && tool.available, "not available");
        require(tool.owner != msg.sender, "cannot borrow own tool");
        require(durationDays > 0 && durationDays <= 30, "duration 1-30 days");
        tool.available = false;
        id = ++loanCount;
        loans[id] = Loan(id, toolId, msg.sender, durationDays, 0, 0, 0, LoanStatus.Requested);
        _toolLoans[toolId].push(id);
        require(usdc.transferFrom(msg.sender, address(this), tool.deposit), "deposit failed");
        emit LoanRequested(id, toolId, msg.sender);
    }

    function acceptLoan(uint256 id) external {
        Loan storage loan = loans[id];
        Tool storage tool = tools[loan.toolId];
        require(tool.owner == msg.sender, "owner only");
        require(loan.status == LoanStatus.Requested, "not requested");
        loan.status = LoanStatus.Active;
        loan.startedAt = uint64(block.timestamp);
        loan.dueAt = uint64(block.timestamp + uint256(loan.durationDays) * DAY);
        emit LoanStarted(id, loan.dueAt);
    }

    function rejectLoan(uint256 id) external nonReentrant {
        Loan storage loan = loans[id];
        Tool storage tool = tools[loan.toolId];
        require(tool.owner == msg.sender, "owner only");
        require(loan.status == LoanStatus.Requested, "not requested");
        loan.status = LoanStatus.Rejected;
        tool.available = tool.active;
        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
        emit LoanClosed(id, LoanStatus.Rejected);
    }

    function cancelRequest(uint256 id) external nonReentrant {
        Loan storage loan = loans[id];
        Tool storage tool = tools[loan.toolId];
        require(loan.borrower == msg.sender, "borrower only");
        require(loan.status == LoanStatus.Requested, "not requested");
        loan.status = LoanStatus.Cancelled;
        tool.available = tool.active;
        require(usdc.transfer(loan.borrower, tool.deposit), "refund failed");
        emit LoanClosed(id, LoanStatus.Cancelled);
    }

    function markReturned(uint256 id) external {
        Loan storage loan = loans[id];
        require(loan.borrower == msg.sender, "borrower only");
        require(loan.status == LoanStatus.Active, "not active");
        loan.status = LoanStatus.ReturnMarked;
        loan.returnMarkedAt = uint64(block.timestamp);
        emit ReturnMarked(id, loan.returnMarkedAt);
    }

    function confirmReturned(uint256 id) external nonReentrant {
        Loan storage loan = loans[id];
        require(tools[loan.toolId].owner == msg.sender, "owner only");
        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
        _settle(id);
    }

    function finalizeUnconfirmedReturn(uint256 id) external nonReentrant {
        Loan storage loan = loans[id];
        require(loan.borrower == msg.sender, "borrower only");
        require(loan.status == LoanStatus.ReturnMarked, "return not marked");
        require(block.timestamp >= uint256(loan.returnMarkedAt) + OWNER_RESPONSE_WINDOW, "response window");
        _settle(id);
    }

    function _settle(uint256 id) private {
        Loan storage loan = loans[id];
        Tool storage tool = tools[loan.toolId];
        uint256 lateDays;
        if (loan.returnMarkedAt > loan.dueAt) {
            lateDays = (uint256(loan.returnMarkedAt) - loan.dueAt + DAY - 1) / DAY;
        }
        uint256 ownerFee = lateDays * tool.dailyLateFee;
        if (ownerFee > tool.deposit) ownerFee = tool.deposit;
        uint256 refund = tool.deposit - ownerFee;
        loan.status = LoanStatus.Complete;
        tool.available = tool.active;
        Reputation storage rep = reputation[loan.borrower];
        rep.completedLoans++;
        if (lateDays > 0) rep.lateReturns++;
        if (ownerFee > 0) require(usdc.transfer(tool.owner, ownerFee), "fee failed");
        if (refund > 0) require(usdc.transfer(loan.borrower, refund), "refund failed");
        emit LoanSettled(id, ownerFee, refund, lateDays > 0);
    }

    function toolLoanIds(uint256 toolId) external view returns (uint256[] memory) {
        return _toolLoans[toolId];
    }
}
