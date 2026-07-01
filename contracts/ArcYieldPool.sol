// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice USDC (ARC) V2 yield pool with lock tiers, auto-compound, and owner-funded boosts.
/// @dev Users must approve this contract before depositing.
contract ArcYieldPool {
    IERC20 public immutable stakingToken;
    address public owner;

    uint256 public constant FLEX_APY_BPS = 500;
    uint256 public constant LOCK_7_APY_BPS = 550;
    uint256 public constant LOCK_30_APY_BPS = 650;
    uint256 public constant EARLY_BOOST_BPS = 50;
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;

    uint256 public earlyBoostLimit = 100;
    uint256 public boostedUsers;
    uint256 public totalPrincipal;
    bool public paused;

    struct Position {
        uint256 principal;
        uint256 rewardDebt;
        uint256 updatedAt;
        uint256 unlockAt;
        uint256 apyBps;
        bool autoCompound;
        uint256 boostBps;
    }

    mapping(address => Position) public positions;
    mapping(address => bool) public hasEarlyBoost;

    event Deposited(address indexed user, uint256 amount, uint256 lockDays, bool autoCompound, uint256 apyBps);
    event Withdrawn(address indexed user, uint256 principal, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 rewards);
    event RewardsFunded(address indexed owner, uint256 amount);
    event BonusDistributed(address indexed user, uint256 amount);
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

    function deposit(uint256 amount, uint256 lockDays, bool autoCompound) external whenNotPaused {
        require(amount > 0, "amount required");
        require(lockDays == 0 || lockDays == 7 || lockDays == 30, "invalid lock");

        _accrue(msg.sender);

        Position storage position = positions[msg.sender];
        if (!hasEarlyBoost[msg.sender] && boostedUsers < earlyBoostLimit) {
            hasEarlyBoost[msg.sender] = true;
            boostedUsers += 1;
            position.boostBps = EARLY_BOOST_BPS;
        }

        uint256 baseApy = _baseApy(lockDays);
        position.apyBps = baseApy + position.boostBps;
        position.autoCompound = autoCompound;
        position.principal += amount;
        position.updatedAt = block.timestamp;

        uint256 unlockAt = block.timestamp + (lockDays * 1 days);
        if (unlockAt > position.unlockAt) position.unlockAt = unlockAt;

        totalPrincipal += amount;
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Deposited(msg.sender, amount, lockDays, autoCompound, position.apyBps);
    }

    function withdraw(uint256 amount) external {
        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        require(block.timestamp >= position.unlockAt, "locked");
        require(amount > 0 && amount <= position.principal, "invalid amount");

        uint256 rewards = position.autoCompound ? 0 : _payableRewards(position.rewardDebt);
        position.rewardDebt -= rewards;
        position.principal -= amount;
        totalPrincipal -= amount;

        require(stakingToken.transfer(msg.sender, amount + rewards), "transfer failed");
        emit Withdrawn(msg.sender, amount, rewards);
    }

    function claimRewards() external {
        _accrue(msg.sender);
        Position storage position = positions[msg.sender];
        require(!position.autoCompound, "auto-compound enabled");

        uint256 rewards = _payableRewards(position.rewardDebt);
        require(rewards > 0, "no rewards");
        position.rewardDebt -= rewards;
        require(stakingToken.transfer(msg.sender, rewards), "transfer failed");
        emit RewardsClaimed(msg.sender, rewards);
    }

    function fundRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "amount required");
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit RewardsFunded(msg.sender, amount);
    }

    function distributeBonus(address user, uint256 amount) external onlyOwner {
        require(amount > 0, "amount required");
        require(_payableRewards(amount) == amount, "insufficient reward reserve");
        require(stakingToken.transfer(user, amount), "transfer failed");
        emit BonusDistributed(user, amount);
    }

    function setPaused(bool nextPaused) external onlyOwner {
        paused = nextPaused;
        emit Paused(nextPaused);
    }

    function pendingRewards(address user) public view returns (uint256) {
        Position memory position = positions[user];
        if (position.principal == 0) return position.rewardDebt;
        uint256 elapsed = block.timestamp - position.updatedAt;
        uint256 newRewards = (position.principal * position.apyBps * elapsed) / (BPS * YEAR);
        return position.rewardDebt + newRewards;
    }

    function _accrue(address user) internal {
        Position storage position = positions[user];
        if (position.updatedAt == 0) {
            position.updatedAt = block.timestamp;
            return;
        }

        uint256 rewards = pendingRewards(user);
        if (position.autoCompound && rewards > 0) {
            uint256 payableRewards = _payableRewards(rewards);
            position.principal += payableRewards;
            totalPrincipal += payableRewards;
            position.rewardDebt = rewards - payableRewards;
        } else {
            position.rewardDebt = rewards;
        }
        position.updatedAt = block.timestamp;
    }

    function _baseApy(uint256 lockDays) internal pure returns (uint256) {
        if (lockDays == 30) return LOCK_30_APY_BPS;
        if (lockDays == 7) return LOCK_7_APY_BPS;
        return FLEX_APY_BPS;
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
