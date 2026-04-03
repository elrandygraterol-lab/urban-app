/**
 * Utility functions for formatting addresses
 */

/**
 * Shorten a long address to show only the most relevant parts
 * @param address - Full address string
 * @param maxLength - Maximum length of the shortened address
 * @returns Shortened address
 */
export function shortenAddress(address: string, maxLength: number = 50): string {
  if (!address) return '';
  
  // If address is already short enough, return as is
  if (address.length <= maxLength) {
    return address;
  }

  // Try to extract the most relevant parts
  // Common patterns in Venezuelan addresses:
  // "Street Name, Neighborhood, Municipality, State, Postal Code, Country"
  
  const parts = address.split(',').map(part => part.trim());
  
  if (parts.length >= 2) {
    // Return first two parts (usually street and neighborhood)
    const shortened = `${parts[0]}, ${parts[1]}`;
    
    if (shortened.length <= maxLength) {
      return shortened;
    }
    
    // If still too long, just return the first part
    return parts[0].length <= maxLength ? parts[0] : `${parts[0].substring(0, maxLength - 3)}...`;
  }
  
  // If no commas, just truncate
  return `${address.substring(0, maxLength - 3)}...`;
}

/**
 * Extract the main street or location name from an address
 * @param address - Full address string
 * @returns Main location name
 */
export function getMainLocation(address: string): string {
  if (!address) return '';
  
  const parts = address.split(',').map(part => part.trim());
  return parts[0] || address;
}

/**
 * Format address for display in a compact card
 * Shows street and neighborhood only
 * @param address - Full address string
 * @returns Formatted address for card display
 */
export function formatAddressForCard(address: string): string {
  if (!address) return '';
  
  const parts = address.split(',').map(part => part.trim());
  
  if (parts.length === 1) {
    return parts[0];
  }
  
  if (parts.length >= 2) {
    // Return street and neighborhood
    return `${parts[0]}, ${parts[1]}`;
  }
  
  return address;
}
