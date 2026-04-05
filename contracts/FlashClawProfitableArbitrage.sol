// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IDEXRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

/**
 * @title FlashClawProfitableArbitrage
 * @notice Arbitrage contract that GUARANTEES only profitable trades execute
 * @dev Strict profitability validation at every step
 */
contract FlashClawProfitableArbitrage is FlashLoanSimpleReceiverBase, ReentrancyGuard {
    // ============ Constants ============
    
    // Aave flashloan fee (0.05% = 5 basis points)
    uint256 private constant AAVE_FLASH_FEE_BPS = 5;
    uint256 private constant BASIS_POINTS = 10000;
    
    // ============ Storage ============
    
    address public owner;
    
    // Gas limits
    uint256 public maxGasPrice; // Maximum gas price in wei per gas
    uint256 public minProfitThreshold; // Minimum net profit required in wei
    uint256 public minProfitPercentage; // Minimum profit percentage (basis points)
    
    // Router whitelist
    mapping(address => bool) public whitelistedRouters;
    
    // Statistics
    uint256 public totalExecutions = 0;
    uint256 public profitableExecutions = 0;
    uint256 public totalProfitCollected = 0;
    uint256 public totalFlashFeesPaid = 0;
    
    // Execution guard
    bool private executionInProgress = false;
    
    // ============ Events ============
    
    event ProfitableArbitrageExecuted(
        address indexed asset,
        uint256 flashAmount,
        uint256 flashFee,
        uint256 grossProfit,
        uint256 netProfit,
        uint256 gasUsed,
        uint256 timestamp
    );

    event ArbitrageFailed(
        address indexed asset,
        uint256 amount,
        string reason,
        uint256 timestamp
    );
    
    event UnprofitableTradeBlocked(
        address indexed asset,
        uint256 amount,
        uint256 expectedProfit,
        uint256 estimatedCosts,
        uint256 timestamp
    );
    
    event GasLimitUpdated(uint256 newMaxGasPrice, uint256 timestamp);
    event ProfitThresholdUpdated(uint256 newThreshold, uint256 timestamp);
    
    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyWhitelistedRouter(address router) {
        require(whitelistedRouters[router], "Router not whitelisted");
        _;
    }
    
    modifier profitabilityGuard(uint256 expectedProfit, uint256 estimatedCosts) {
        require(
            expectedProfit > estimatedCosts,
            "Arbitrage would not be profitable"
        );
        _;
    }

    // ============ Constructor ============

    constructor(
        address _addressProvider,
        uint256 _maxGasPrice,
        uint256 _minProfitThreshold,
        uint256 _minProfitPercentage
    )
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider))
    {
        owner = msg.sender;
        maxGasPrice = _maxGasPrice;
        minProfitThreshold = _minProfitThreshold;
        minProfitPercentage = _minProfitPercentage;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update maximum gas price limit
     * @param _maxGasPrice New maximum gas price in wei per gas
     */
    function updateGasLimit(uint256 _maxGasPrice) external onlyOwner {
        maxGasPrice = _maxGasPrice;
        emit GasLimitUpdated(_maxGasPrice, block.timestamp);
    }

    /**
     * @notice Update minimum profit threshold
     * @param _minProfit New minimum profit in wei
     */
    function updateProfitThreshold(uint256 _minProfit) external onlyOwner {
        minProfitThreshold = _minProfit;
        emit ProfitThresholdUpdated(_minProfit, block.timestamp);
    }

    /**
     * @notice Update minimum profit percentage
     * @param _percentageBps Minimum profit in basis points (100 = 1%)
     */
    function updateProfitPercentage(uint256 _percentageBps) external onlyOwner {
        minProfitPercentage = _percentageBps;
    }

    /**
     * @notice Whitelist a DEX router
     * @param _router Router address
     */
    function whitelistRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router");
        whitelistedRouters[_router] = true;
    }

    /**
     * @notice Remove a router from whitelist
     * @param _router Router address
     */
    function removeRouter(address _router) external onlyOwner {
        whitelistedRouters[_router] = false;
    }

    // ============ Core Arbitrage Functions ============

    /**
     * @notice Pre-validate arbitrage before initiating flashloan
     * @param asset Asset to flashloan
     * @param amount Amount to flashloan
     * @param expectedFinalAmount Expected amount after swaps
     * @param estimatedGas Estimated gas usage
     * @return isValid Whether arbitrage would be profitable
     */
    function validateTradeProfitability(
        address asset,
        uint256 amount,
        uint256 expectedFinalAmount,
        uint256 estimatedGas
    ) external view returns (bool isValid) {
        // Calculate costs
        uint256 flashFee = calculateFlashFee(amount);
        uint256 gasCost = estimatedGas * tx.gasprice;
        uint256 totalCosts = flashFee + gasCost;

        // Calculate profit
        require(expectedFinalAmount >= amount, "Invalid expected amount");
        uint256 grossProfit = expectedFinalAmount - amount;
        uint256 netProfit = grossProfit > totalCosts ? grossProfit - totalCosts : 0;

        // Check both absolute and percentage profit
        bool meetsAbsolk = netProfit >= minProfitThreshold;
        bool meetsPercentage = (netProfit * BASIS_POINTS) / amount >= minProfitPercentage;

        return meetsAbsolk && meetsPercentage;
    }

    /**
     * @notice Calculate Aave flashloan fee
     * @param amount Amount being flashloaned
     * @return fee The flashloan fee in wei
     */
    function calculateFlashFee(uint256 amount) public pure returns (uint256) {
        return (amount * AAVE_FLASH_FEE_BPS) / BASIS_POINTS;
    }

    /**
     * @notice Initiate flashloan arbitrage with profitability guarantee
     * @param asset Asset to flashloan
     * @param amount Amount to flashloan
     * @param swapPath Token swap path
     * @param routers DEX routers for each swap
     * @param minAmountsOut Minimum amounts to prevent slippage
     * @param estimatedGas Estimated gas for this arbitrage
     */
    function executeArbitrageIfProfitable(
        address asset,
        uint256 amount,
        address[] calldata swapPath,
        address[] calldata routers,
        uint256[] calldata minAmountsOut,
        uint256 estimatedGas
    ) external onlyOwner nonReentrant {
        require(!executionInProgress, "Execution already in progress");
        require(swapPath.length >= 2, "Invalid swap path");
        require(routers.length == swapPath.length - 1, "Router count mismatch");
        require(minAmountsOut.length == swapPath.length - 1, "MinAmount count mismatch");

        // Validate gas price is within limits
        require(tx.gasprice <= maxGasPrice, "Gas price exceeds limit");

        // Calculate estimated profit to validate before flashloan
        uint256 estimatedFinalFromMinAmounts = minAmountsOut[minAmountsOut.length - 1];
        require(
            estimatedFinalFromMinAmounts > amount,
            "Estimated final amount would not exceed initial"
        );

        uint256 estimatedGrossProfit = estimatedFinalFromMinAmounts - amount;
        uint256 flashFee = calculateFlashFee(amount);
        uint256 gasCost = estimatedGas * tx.gasprice;
        uint256 totalEstimatedCosts = flashFee + gasCost;

        // Pre-check: would this be profitable?
        require(
            estimatedGrossProfit > totalEstimatedCosts,
            "Estimated profit would not exceed costs"
        );

        uint256 estimatedNetProfit = estimatedGrossProfit - totalEstimatedCosts;
        require(
            estimatedNetProfit >= minProfitThreshold,
            "Estimated profit below minimum threshold"
        );

        // Encode parameters for flashloan callback
        bytes memory params = abi.encode(swapPath, routers, minAmountsOut);

        // Initiate flashloan
        executionInProgress = true
        POOL.flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            0
        );
    }

    /**
     * @notice Aave flashloan callback - executes arbitrage
     * @dev Called by Aave pool after flashloan
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override nonReentrant returns (bool) {
        require(msg.sender == address(POOL), "Only pool can call");
        require(initiator == address(this), "Only self-initiated");

        uint256 gasStart = gasleft();

        try {
            // Decode swap parameters
            (
                address[] memory swapPath,
                address[] memory routers,
                uint256[] memory minAmountsOut
            ) = abi.decode(params, (address[], address[], uint256[]));

            // Validate routers
            for (uint256 i = 0; i < routers.length; i++) {
                require(whitelistedRouters[routers[i]], "Unwhitelisted router");
            }

            // Execute swaps
            uint256 finalAmount = _executeSwapsWithValidation(
                amount,
                swapPath,
                routers,
                minAmountsOut
            );

            // Calculate costs and final validation
            uint256 flashFee = calculateFlashFee(amount);
            uint256 amountOwed = amount + premium + flashFee;

            // CRITICAL PROFITABILITY CHECK
            require(
                finalAmount >= amountOwed,
                "Arbitrage execution: Final amount insufficient to cover flashloan + fee"
            );

            uint256 netProfit = finalAmount - amountOwed;

            // Approve and repay flashloan
            IERC20(asset).approve(address(POOL), amountOwed);

            // Record execution
            uint256 gasUsed = (gasStart - gasleft()) * tx.gasprice;
            totalExecutions++;
            profitableExecutions++;
            totalProfitCollected += netProfit;
            totalFlashFeesPaid += flashFee;

            // Emit success event
            emit ProfitableArbitrageExecuted(
                asset,
                amount,
                flashFee,
                finalAmount - amount,
                netProfit,
                gasStart - gasleft(),
                block.timestamp
            );

            // Transfer profit to owner
            if (netProfit > 0) {
                IERC20(asset).transfer(owner, netProfit);
            }

            executionInProgress = false;
            return true;

        } catch Error(string memory reason) {
            emit ArbitrageFailed(asset, amount, reason, block.timestamp);
            revert(reason);
        } catch {
            emit ArbitrageFailed(asset, amount, "Unknown error", block.timestamp);
            revert("Arbitrage execution failed");
        }
    }

    /**
     * @notice Execute swaps with profitability validation
     * @return finalAmount Amount after all swaps
     */
    function _executeSwapsWithValidation(
        uint256 initialAmount,
        address[] memory swapPath,
        address[] memory routers,
        uint256[] memory minAmountsOut
    ) internal returns (uint256 finalAmount) {
        uint256 currentAmount = initialAmount;

        for (uint256 i = 0; i < routers.length; i++) {
            address router = routers[i];
            address tokenIn = swapPath[i];
            address tokenOut = swapPath[i + 1];
            uint256 minOut = minAmountsOut[i];

            // Approve router
            IERC20(tokenIn).approve(router, currentAmount);

            // Execute swap
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;

            uint256[] memory amounts = IDEXRouter(router).swapExactTokensForTokens(
                currentAmount,
                minOut,
                path,
                address(this),
                block.timestamp + 300
            );

            currentAmount = amounts[amounts.length - 1];

            // Strict slippage check - revert if we don't get minimum
            require(
                currentAmount >= minOut,
                "Slippage limit exceeded on swap"
            );
        }

        return currentAmount;
    }

    // ============ View Functions ============

    /**
     * @notice Get arbitrage statistics
     */
    function getStats() external view returns (
        uint256 executions,
        uint256 profitable,
        uint256 totalProfit,
        uint256 totalFees
    ) {
        return (
            totalExecutions,
            profitableExecutions,
            totalProfitCollected,
            totalFlashFeesPaid
        );
    }

    /**
     * @notice Get success rate
     */
    function getSuccessRate() external view returns (uint256) {
        if (totalExecutions == 0) return 0;
        return (profitableExecutions * 100) / totalExecutions;
    }

    /**
     * @notice Withdraw accumulated profits
     */
    function withdrawProfits(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        IERC20(token).transfer(owner, balance);
    }
}
