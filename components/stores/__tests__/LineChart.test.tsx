import React from 'react';
import { render } from '@testing-library/react-native';
import { LineChart } from '../LineChart';

describe('LineChart', () => {
  const mockData = [
    { date: '2024-01-01', views: 10 },
    { date: '2024-01-02', views: 15 },
    { date: '2024-01-03', views: 8 },
    { date: '2024-01-04', views: 20 },
    { date: '2024-01-05', views: 12 },
  ];

  it('renders without crashing', () => {
    const { toJSON } = render(<LineChart data={mockData} width={300} height={200} />);
    expect(toJSON()).toBeTruthy();
  });

  it('displays empty state when no data', () => {
    const { getByText } = render(<LineChart data={[]} width={300} height={200} />);
    expect(getByText('Sin datos disponibles')).toBeTruthy();
  });

  it('renders with valid data', () => {
    const { toJSON } = render(<LineChart data={mockData} width={300} height={200} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
