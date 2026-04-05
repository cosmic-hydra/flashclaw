// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IDEXRouter.sol";

/**
 * @title FlashClawArbitrageV2
 * @notice Enhanced arbitrage contract with better abstractions and safety
 * @dev Supports multiple DEX routers and implements circuit breaker pattern
 */
contract FlashClawArbitrageV2 is FlashLoanSimpleReceiverBase, ReentrancyGuard {
    // ============ Storage ============
    
    address public owner;
    
    // Circuit breaker settings
    uint256 public maxConsecutiveFailures = 5;
    uint256 public consecutiveFailures = 0;
    bool public circuitBreakerTripped = false;
    uint256 public lastSuccessTime;
    uint256 public circuitBreakerCooldown = 1 hours;
    
    // Statistics
    uint256 public totalArbitragesExecuted = 0;
    uint256 public totalSuccessfulArbitrages = 0;
    uint256 public totalFailedArbitrages = 0;
    uint256 public totalProfitCollected = 0;
    
    // Registered DEX routers
    mapping(address => bool) public whitelistedRouters;
    
    // ============ Structures ============
    
    struct ArbitrageExecution {
        address[] swapPath;           // Token swap path
        address[] routerPath;         // Router for each hop
        uint256[] minAmountsOut;      // Minimum output amounts (slippage protection)
        uint256 flashFee;             // Expected flashloan fee in wei
        bool executeImmediately;      // Whether to revert if unprofitable
    }
    
    // ============ Events ============
    
    event ArbitrageExecuted(
        address indexed asset,
        uint256 amount,
        uint256 profit,
        uint256 gasUsed,
        uint256 timestamp
    );

    event ArbitrageFailed(
        address indexed asset,
        uint256 amount,
        string reason,
        uint256 timestamp
    );
    
    event CircuitBreakerTripped(
        uint256 failureCount,
        uint256 timestamp
    );
    
    event CircuitBreakerReset(
        uint256 timestamp
    );
    
    event RouterWhitelisted(
        address indexed router,
        uint256 timestamp
    );
    
    event RouterRemoved(
        address indexed router,
        uint256 timestamp
    );

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier circuitBreakerActive() {
        if (circuitBreakerTripped) {
            require(
                block.timestamp >= lastSuccessTime + circuitBreakerCooldown,
                "Circuit breaker cooldown active"
            );
            circuitBreakerTripped = false;
            consecutiveFailures = 0;
            emit CircuitBreakerReset(block.timestamp);
        }
        _;
    }
    
    modifier onlyWhitelistedRouters(address[] memory routers) {
        for (uint256 i = 0; i < routers.length; i++) {
            require(whitelistedRouters[routers[i]], "Router not whitelisted");
        }
        _;
    }

    // ============ Constructor ============

    constructor(address _addressProvider) 
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider))
    {
        owner = msg.sender;
        lastSuccessTime = block.timestamp;
    }

    // ============ Admin Functions ============

    /**
     * @notice Whitelist a DEX router
     * @param _router Router address to whitelist
     */
    function whitelistRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router");
        whitelistedRouters[_router] = true;
        emit RouterWhitelisted(_router, block.timestamp);
    }

    /**
     * @notice Remove a DEX router from whitelist
     * @param _router Router address to remove
     */
    function removeRouter(address _router) external onlyOwner {
        whitelistedRouters[_router] = false;
        emit RouterRemoved(_router, block.timestamp);
    }

    /**
     * @notice Update circuit breaker settings
     * @param _maxFailures Maximum consecutive failures before breaker trips
     * @param _cooldown Cooldown period before breaker resets
     */
    function updateCircuitBreaker(uint256 _maxFailures, uint256 _cooldown) 
        external onlyOwner 
    {
        maxConsecutiveFailures = _maxFailures;
        circuitBreakerCooldown = _cooldown;
    }

    /**
     * @notice Manually reset circuit breaker
     */
    function resetCircuitBreaker() external onlyOwner {
        circuitBreakerTripped = false;
        consecutiveFailures = 0;
        lastSuccessTime = block.timestamp;
        emit CircuitBreakerReset(block.timestamp);
    }

    // ============ Arbitrage Execution ============

    /**
     * @notice Initiate a flashloan arbitrage
     * @param asset The token to flashloan
     * @param amount Amount to borrow
     * @param execution Arbitrage execution parameters
     */
    function executeArbitrage(
        address asset,
        uint256 amount,
        ArbitrageExecution calldata execution
    ) external onlyOwner circuitBreakerActive nonReentrant 
        onlyWhitelistedRouters(execution.routerPath)
    {
        _validateArbitrageParams(execution);
        
        bytes memory params = abi.encode(execution);
        POOL.flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            0  // referralCode
        );
    }

    /**
     * @notice Aave flashloan callback
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override nonReentrant returns (bool) {
        require(msg.sender == address(POOL), "Only pool");
        require(initiator == address(this), "Only self-initiated");

        ArbitrageExecution memory execution = abi.decode(params, (ArbitrageExecution));

        uint256 gasStart = gasleft();

        try this._executeArbitrage(asset, amount, premium, execution) 
            returns (uint256 profit)
        {
            uint256 gasUsed = gasStart - gasleft();
            _recordSuccess(profit, asset, amount, gasUsed);
            return true;
        } catch Error(string memory reason) {
            _recordFailure(reason, asset, amount);
            revert(reason);
        } catch {
            _recordFailure("Unknown error", asset, amount);
            revert("Arbitrage failed");
        }
    }

    /**
     * @notice Internal arbitrage execution
     */
    function _executeArbitrage(
        address asset,
        uint256 amount,
        uint256 premium,
        ArbitrageExecution calldata execution
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "Only self");

        uint256 amountOwed = amount + premium;
        
        // Execute swaps
        uint256 finalAmount = _executeSwaps(amount, execution);

        // Validate profitability
        require(finalAmount >= amountOwed, "Arbitrage unprofitable");

        // Approve repayment
        IERC20(asset).approve(address(POOL), amountOwed);

        // Calculate profit
        profit = finalAmount - amountOwed;

        // Transfer profit to owner
        if (profit > 0) {
            IERC20(asset).transfer(owner, profit);
        }
    }

    /**
     * @notice Execute token swaps across multiple routers
     */
    function _executeSwaps(
        uint256 initialAmount,
        ArbitrageExecution calldata execution
    ) internal returns (uint256 currentAmount) {
        currentAmount = initialAmount;

        for (uint256 i = 0; i < execution.routerPath.length; i++) {
            address router = execution.routerPath[i];
            address tokenIn = execution.swapPath[i];
            address tokenOut = execution.swapPath[i + 1];

            // Approve router
            IERC20(tokenIn).approve(router, currentAmount);

            // Execute swap
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;

            uint256 minOut = execution.minAmountsOut[i];

            uint[] memory amounts = IDEXRouter(router).swapExactTokensForTokens(
                currentAmount,
                minOut,
                path,
                address(this),
                block.timestamp + 300
            );

            currentAmount = amounts[amounts.length - 1];

            // Safety check: ensure we got at least minimum amount
            require(currentAmount >= minOut, "Slippage exceeded");
        }

        return currentAmount;
    }

    // ============ Internal Functions ============

    /**
     * @notice Validate arbitrage parameters
     */
    function _validateArbitrageParams(ArbitrageExecution calldata execution) 
        internal pure 
    {
        require(execution.swapPath.length >= 2, "Invalid path length");
        require(
            execution.routerPath.length == execution.swapPath.length - 1,
            "Router count mismatch"
        );
        require(
            execution.minAmountsOut.length == execution.swapPath.length - 1,
            "MinAmount count mismatch"
        );
    }

    /**
     * @notice Record successful arbitrage
     */
    function _recordSuccess(
        uint256 profit,
        address asset,
        uint256 amount,
        uint256 gasUsed
    ) internal {
        totalArbitragesExecuted++;
        totalSuccessfulArbitrages++;
        totalProfitCollected += profit;
        consecutiveFailures = 0;
        lastSuccessTime = block.timestamp;

        emit ArbitrageExecuted(asset, amount, profit, gasUsed, block.timestamp);
    }

    /**
     * @notice Record failed arbitrage and check circuit breaker
     */
    function _recordFailure(
        string memory reason,
        address asset,
        uint256 amount
    ) internal {
        totalArbitragesExecuted++;
        totalFailedArbitrages++;
        consecutiveFailures++;

        emit ArbitrageFailed(asset, amount, reason, block.timestamp);

        if (consecutiveFailures >= maxConsecutiveFailures) {
            circuitBreakerTripped = true;
            emit CircuitBreakerTripped(consecutiveFailures, block.timestamp);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get arbitrage statistics
     */
    function getStats() external view returns (
        uint256 executed,
        uint256 successful,
        uint256 failed,
        uint256 profit,
        bool circuitOpen
    ) {
        return (
            totalArbitragesExecuted,
            totalSuccessfulArbitrages,
            totalFailedArbitrages,
            totalProfitCollected,
            circuitBreakerTripped
        );
    }

    /**
     * @notice Get success rate
     */
    function getSuccessRate() external view returns (uint256) {
        if (totalArbitragesExecuted == 0) return 0;
        return (totalSuccessfulArbitrages * 100) / totalArbitragesExecuted;
    }

    /**
     * @notice Check if arbitrage is currently allowed
     */
    function isArbitrageAllowed() external view returns (bool) {
        if (circuitBreakerTripped) {
            return block.timestamp >= lastSuccessTime + circuitBreakerCooldown;
        }
        return true;
    }

    /**
     * @notice Withdraw collected profits
     */
    function withdrawProfits(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        IERC20(token).transfer(owner, balance);
    }
}
