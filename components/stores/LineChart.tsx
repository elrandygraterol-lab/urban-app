import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface DataPoint {
  date: string;
  views: number;
}

interface LineChartProps {
  data: DataPoint[];
  width: number;
  height: number;
}

/**
 * Simple Line Chart Component
 * 
 * Displays daily views as a line chart
 * Requirements: 14.7
 */
export const LineChart: React.FC<LineChartProps> = ({ data, width, height }) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.emptyText}>Sin datos disponibles</Text>
      </View>
    );
  }

  // Chart dimensions
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Calculate min and max values
  const values = data.map(d => d.views);
  const maxValue = Math.max(...values, 1); // Ensure at least 1 to avoid division by zero
  const minValue = 0; // Always start from 0 for views

  // Calculate points
  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((point.views - minValue) / (maxValue - minValue || 1)) * chartHeight;
    return { x, y, value: point.views, date: point.date };
  });

  // Create polyline points string
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Format date for display (show only day/month)
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    } catch {
      return dateStr;
    }
  };

  // Calculate Y-axis labels (show 4 labels)
  const yAxisLabels = [
    maxValue,
    Math.round(maxValue * 0.66),
    Math.round(maxValue * 0.33),
    0,
  ];

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Y-axis grid lines and labels */}
        {yAxisLabels.map((label, index) => {
          const y = padding + (index / (yAxisLabels.length - 1)) * chartHeight;
          return (
            <React.Fragment key={`y-${index}`}>
              {/* Grid line */}
              <Line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke={Colors.border}
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              {/* Label */}
              <SvgText
                x={padding - 8}
                y={y + 4}
                fontSize="10"
                fill={Colors.mediumGray}
                textAnchor="end"
              >
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis */}
        <Line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke={Colors.border}
          strokeWidth="2"
        />

        {/* Y-axis */}
        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke={Colors.border}
          strokeWidth="2"
        />

        {/* Line chart */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={Colors.primary}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={Colors.primary}
            stroke={Colors.white}
            strokeWidth="2"
          />
        ))}

        {/* X-axis labels (dates) */}
        {points.map((point, index) => {
          // Show labels for first, last, and middle points to avoid crowding
          const shouldShowLabel =
            index === 0 ||
            index === points.length - 1 ||
            (points.length > 4 && index === Math.floor(points.length / 2));

          if (!shouldShowLabel) return null;

          return (
            <SvgText
              key={`label-${index}`}
              x={point.x}
              y={height - padding + 20}
              fontSize="10"
              fill={Colors.mediumGray}
              textAnchor="middle"
            >
              {formatDate(point.date)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.mediumGray,
  },
});
