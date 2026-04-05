// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDEXRouter
 * @notice Standard interface for DEX routers to enable plugin architecture
 */
interface IDEXRouter {
    /**
     * @notice Get the amount out for exact tokens in
     * @param amountIn Amount of input token
     * @param path Token path for swap
     * @return amounts Array of amounts out for each swap step
     */
    function getAmountsOut(uint amountIn, address[] memory path)
        external view returns (uint[] memory amounts);

    /**
     * @notice Execute swap with exact input amount
     * @param amountIn Exact input amount
     * @param amountOutMin Minimum output amount (slippage protection)
     * @param path Token swap path
     * @param to Recipient address
     * @param deadline Transaction deadline
     * @return amounts Array of amounts for each step
     */
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    /**
     * @notice Execute swap with exact output amount
     * @param amountOut Exact output amount
     * @param amountInMax Maximum input amount (slippage protection)
     * @param path Token swap path
     * @param to Recipient address
     * @param deadline Transaction deadline
     * @return amounts Array of amounts for each step
     */
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}
