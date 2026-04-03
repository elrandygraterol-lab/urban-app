/**
 * Currency utility functions for multi-currency support
 */

export type Currency = 'USD' | 'VES';

export interface CurrencyConfig {
  symbol: string;
  name: string;
  decimals: number;
}

export const CURRENCY_CONFIGS: Record<Currency, CurrencyConfig> = {
  USD: {
    symbol: '$',
    name: 'Dólares',
    decimals: 2,
  },
  VES: {
    symbol: 'Bs.',
    name: 'Bolívares',
    decimals: 2,
  },
};

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_CONFIGS[currency]?.symbol || '$';
}

/**
 * Get currency name for a given currency code
 */
export function getCurrencyName(currency: Currency): string {
  return CURRENCY_CONFIGS[currency]?.name || 'Dólares';
}

/**
 * Format amount with currency symbol
 * @param amount - The numeric amount to format
 * @param currency - The currency code (USD or VES)
 * @param includeSymbol - Whether to include the currency symbol (default: true)
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: Currency = 'USD',
  includeSymbol: boolean = true
): string {
  const config = CURRENCY_CONFIGS[currency] || CURRENCY_CONFIGS.USD;
  const formattedAmount = amount.toFixed(config.decimals);
  
  return includeSymbol ? `${config.symbol} ${formattedAmount}` : formattedAmount;
}

/**
 * Parse currency string to number
 * @param currencyString - String like "$ 10.50" or "Bs. 25.00"
 * @returns Numeric value
 */
export function parseCurrency(currencyString: string): number {
  // Remove currency symbols and spaces, then parse
  const cleaned = currencyString.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}
