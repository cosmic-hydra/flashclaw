// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IArbitrageOracle
 * @notice Interface for off-chain arbitrage opportunity calculation
 */
interface IArbitrageOracle {
    struct OpportunityData {
        address[] swapPath;              // Token path for arbitrage
        address[] routerPath;            // Router addresses for each hop
        uint256[] minAmountsOut;         // Minimum amounts to prevent slippage
        uint256 expectedProfitWei;       // Expected profit in wei
        uint256 gasEstimate;             // Estimated gas usage
        uint256 flashFee;                // Flashloan fee in basis points
    }

    /**
     * @notice Calculate if an opportunity is profitable after all costs
     * @param opportunity The opportunity data
     * @param gasprice Current gas price in wei
     * @return isProfitable Whether the opportunity is profitable
     * @return netProfit Net profit after all costs
     */
    function isProfitable(OpportunityData calldata opportunity, uint256 gasprice)
        external pure returns (bool isProfitable, uint256 netProfit);

    /**
     * @notice Validate opportunity meets minimum profit threshold
     * @param opportunity The opportunity data
     * @param minProfitThreshold Minimum profit in wei
     * @return isValid Whether opportunity meets threshold
     */
    function validateProfitThreshold(OpportunityData calldata opportunity, uint256 minProfitThreshold)
        external pure returns (bool isValid);
}
