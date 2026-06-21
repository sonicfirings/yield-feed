// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice USDC (ARC) testnet yield pool with owner-funded rewards.
/// @dev Users must approve this contract before depositing.
contract ArcYieldPool {
    IERC20 public immutable stakingToken;
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

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "token required");
        owner = msg.sender;
        stakingToken = IERC20(tokenAddress);
    }

    function deposit(uint256 amount) external whenNotPaused {
        require(amount > 0, "amount required");
        _accrue(msg.sender);
        positions[msg.sender].principal += amount;
        totalPrincipal += amount;
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        require(amount > 0 && amount <= position.principal, "invalid amount");

        uint256 rewards = _payableRewards(position.rewardDebt);
        position.rewardDebt -= rewards;
        position.principal -= amount;
        totalPrincipal -= amount;

        require(stakingToken.transfer(msg.sender, amount + rewards), "transfer failed");
        emit Withdrawn(msg.sender, amount, rewards);
    }

    function claimRewards() external {
        _accrue(msg.sender);
        uint256 rewards = _payableRewards(positions[msg.sender].rewardDebt);
        require(rewards > 0, "no rewards");
        positions[msg.sender].rewardDebt -= rewards;
        require(stakingToken.transfer(msg.sender, rewards), "transfer failed");
        emit RewardsClaimed(msg.sender, rewards);
    }

    function fundRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "amount required");
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit RewardsFunded(msg.sender, amount);
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

    function _payableRewards(uint256 requestedRewards) internal view returns (uint256) {
        uint256 balance = _poolBalance();
        if (balance <= totalPrincipal) return 0;
        uint256 rewardReserve = balance - totalPrincipal;
        return requestedRewards <= rewardReserve ? requestedRewards : rewardReserve;
    }

    function _poolBalance() internal view returns (uint256) {
        (bool success, bytes memory data) = address(stakingToken).staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(success && data.length >= 32, "balance read failed");
        return abi.decode(data, (uint256));
    }
}
