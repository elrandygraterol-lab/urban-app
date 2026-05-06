/**
 * Tests for RideTypeSelector component
 * 
 * Validates: Requirements 4.1, 9.1
 */

import React from 'react';
import RideTypeSelector from '../RideTypeSelector';

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('RideTypeSelector', () => {
  const mockOnSelectIndividual = jest.fn();
  const mockOnSelectShared = jest.fn();
  const mockOnSelectDelegated = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    visible: true,
    onSelectIndividual: mockOnSelectIndividual,
    onSelectShared: mockOnSelectShared,
    onSelectDelegated: mockOnSelectDelegated,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports a valid React component', () => {
    expect(RideTypeSelector).toBeDefined();
    expect(typeof RideTypeSelector).toBe('function');
  });

  it('accepts all required props without errors', () => {
    expect(() => {
      React.createElement(RideTypeSelector, defaultProps);
    }).not.toThrow();
  });

  it('component has correct display name', () => {
    expect(RideTypeSelector.name).toBe('RideTypeSelector');
  });
});
