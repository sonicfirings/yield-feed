// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Native-token ARC testnet yield pool with owner-funded rewards.
/// @dev APY is for UI/accounting transparency. The owner must keep enough rewards funded.
contract ArcYieldPool {
    address public owner;
    uint256 public constant APY_BPS = 500;
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;

    struct Position {
        uint256 principal;
        uint256 rewardDebt;
        uint256 updatedAt;
    }

    mapping(address => Position) public positions;
    uint256 public totalPrincipal;
    bool public paused;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 principal, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 rewards);
    event RewardsFunded(address indexed owner, uint256 amount);
    event Paused(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        fundRewards();
    }

    function deposit() external payable whenNotPaused {
        require(msg.value > 0, "amount required");
        _accrue(msg.sender);
        positions[msg.sender].principal += msg.value;
        totalPrincipal += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        require(amount > 0 && amount <= position.principal, "invalid amount");

        uint256 rewards = position.rewardDebt;
        position.rewardDebt = 0;
        position.principal -= amount;
        totalPrincipal -= amount;

        uint256 payout = amount + rewards;
        require(address(this).balance >= payout, "insufficient pool balance");
        (bool sent,) = msg.sender.call{value: payout}("");
        require(sent, "transfer failed");
        emit Withdrawn(msg.sender, amount, rewards);
    }

    function claimRewards() external {
        _accrue(msg.sender);
        uint256 rewards = positions[msg.sender].rewardDebt;
        require(rewards > 0, "no rewards");
        positions[msg.sender].rewardDebt = 0;
        require(address(this).balance >= totalPrincipal + rewards, "insufficient rewards");
        (bool sent,) = msg.sender.call{value: rewards}("");
        require(sent, "transfer failed");
        emit RewardsClaimed(msg.sender, rewards);
    }

    function fundRewards() public payable onlyOwner {
        require(msg.value > 0, "amount required");
        emit RewardsFunded(msg.sender, msg.value);
    }

    function setPaused(bool nextPaused) external onlyOwner {
        paused = nextPaused;
        emit Paused(nextPaused);
    }

    function pendingRewards(address user) public view returns (uint256) {
        Position memory position = positions[user];
        if (position.principal == 0) return position.rewardDebt;
        uint256 elapsed = block.timestamp - position.updatedAt;
        uint256 newRewards = (position.principal * APY_BPS * elapsed) / (BPS * YEAR);
        return position.rewardDebt + newRewards;
    }

    function _accrue(address user) internal {
        Position storage position = positions[user];
        if (position.updatedAt == 0) {
            position.updatedAt = block.timestamp;
            return;
        }
        position.rewardDebt = pendingRewards(user);
        position.updatedAt = block.timestamp;
    }
}
