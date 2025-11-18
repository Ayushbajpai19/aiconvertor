import React from 'react';

interface ChartData {
  name: string;
  value: number;
  date?: string;
}

interface LineChartProps {
  data: Array<ChartData & { date: string }>;
  xDataKey: string;
  yDataKey: string;
  color?: string;
  height?: number;
  showTooltip?: boolean;
}

interface BarChartProps {
  data: Array<ChartData>;
  dataKey: string;
  color?: string;
  height?: number;
  showTooltip?: boolean;
}

interface PieChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  showTooltip?: boolean;
}

interface ProgressIndicatorProps {
  value: number;
  max: number;
  color?: string;
  showLabel?: boolean;
  height?: string;
}

// Line Chart Component
export const LineChart: React.FC<LineChartProps> = ({
  data,
  xDataKey,
  yDataKey,
  color = '#3b82f6',
  height = 300,
  showTooltip = true,
}) => {
  const [hoveredPoint, setHoveredPoint] = React.useState<any>(null);

  // Calculate chart dimensions and scales
  const padding = 40;
  const chartWidth = 800 - padding * 2;
  const chartHeight = height;

  const xValues = data.map(d => new Date(d[xDataKey]).getTime());
  const yValues = data.map(d => d[yDataKey]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-full"
        onMouseMove={(e) => {
          if (!showTooltip) return;

          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const dataIndex = Math.round((x / chartWidth) * data.length);

          if (dataIndex >= 0 && dataIndex < data.length) {
            setHoveredPoint(data[dataIndex]);
          } else {
            setHoveredPoint(null);
          }
        }}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {/* Grid Lines */}
        {[...Array(6)].map((_, i) => {
          const y = yMin + (yMax - yMin) * (i / 5);
          return (
            <line
              key={`grid-${i}`}
              x1={padding}
              y1={y}
              x2={chartWidth - padding}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
              opacity="0.3"
            />
          );
        })}

        {/* Y-axis labels */}
        {[...Array(6)].map((_, i) => {
          const y = yMin + (yMax - yMin) * (i / 5);
          return (
            <text
              key={`label-${i}`}
              x={padding - 10}
              y={y + 4}
              fill="#6b7280"
              fontSize="12"
              textAnchor="end"
            >
              {Math.round(y)}
            </text>
          );
        })}

        {/* X-axis labels */}
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((point, i) => (
          <text
            key={`x-label-${i}`}
            x={padding + (chartWidth - 2 * padding) * (i / (Math.ceil(data.length / 6) - 1))}
            y={chartHeight - 20}
            fill="#6b7280"
              fontSize="12"
              textAnchor="middle"
            >
              {formatDate(point[xDataKey])}
            </text>
          );
        ))}

        {/* Line path */}
        <path
          d={`M ${data.map((point, i) => {
            const x = padding + (chartWidth - 2 * padding) * (i / (data.length - 1));
            const y = chartHeight - padding - ((point[yDataKey] - yMin) / (yMax - yMin)) * (chartHeight - 2 * padding);
            return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
          }).join(' ')}`}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />

        {/* Data points */}
        {data.map((point, i) => (
          <circle
            key={point[xDataKey]}
            cx={padding + (chartWidth - 2 * padding) * (i / (data.length - 1))}
            cy={chartHeight - padding - ((point[yDataKey] - yMin) / (yMax - yMin)) * (chartHeight - 2 * padding)}
            r="4"
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
        ))}

        {/* Tooltip */}
        {hoveredPoint && showTooltip && (
          <g>
            <rect
              x={padding + (chartWidth - 2 * padding) * (data.indexOf(hoveredPoint)) / (data.length - 1)) - 50}
              y={20}
              width="100"
              height="30"
              fill="white"
              stroke="#d1d5db"
              strokeWidth="1"
              rx="4"
            />
            <text
              x={padding + (chartWidth - 2 * padding) * (data.indexOf(hoveredPoint)) / (data.length - 1))}
              y={35}
              fill="#1f2937"
              fontSize="12"
              fontWeight="bold"
            >
              {hoveredPoint.name}: {hoveredPoint.value}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

// Bar Chart Component
export const BarChart: React.FC<BarChartProps> = ({
  data,
  dataKey,
  color = '#3b82f6',
  height = 300,
  showTooltip = true,
}) => {
  const [hoveredBar, setHoveredBar] = React.useState<any>(null);

  const padding = 40;
  const chartWidth = 800 - padding * 2;
  const chartHeight = height;

  const values = data.map(d => d[dataKey]);
  const maxValue = Math.max(...values);
  const barWidth = (chartWidth - 2 * padding) / data.length * 0.6;
  const barSpacing = (chartWidth - 2 * padding) / data.length * 0.4;

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-full"
        onMouseMove={(e) => {
          if (!showTooltip) return;

          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const index = Math.floor(x / (chartWidth / data.length));

          if (index >= 0 && index < data.length) {
            setHoveredBar(data[index]);
          } else {
            setHoveredBar(null);
          }
        }}
        onMouseLeave={() => setHoveredBar(null)}
      >
        {/* Grid lines and Y-axis labels */}
        {[...Array(6)].map((_, i) => {
          const y = chartHeight - padding - (i / 5) * (chartHeight - 2 * padding);
          const value = Math.round(maxValue * (i / 5));
          return (
            <g key={`grid-${i}`}>
              <line
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
                opacity="0.3"
              />
              <text
                x={padding - 10}
                y={y + 4}
                fill="#6b7280"
                fontSize="12"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, i) => {
          const barHeight = (item[dataKey] / maxValue) * (chartHeight - 2 * padding);
          const x = padding + i * (barWidth + barSpacing) + barSpacing / 2;

          return (
            <g key={item.name}>
              <rect
                x={x}
                y={chartHeight - padding - barHeight}
                width={barWidth}
                height={barHeight}
                fill={color}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight - padding - barHeight - 5}
                fill="white"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
              >
                {item[dataKey]}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {hoveredBar && showTooltip && (
          <g>
            <rect
              x={padding + data.indexOf(hoveredBar) * (barWidth + barSpacing) + barSpacing / 2 - 50}
              y={20}
              width="100"
              height="30"
              fill="white"
              stroke="#d1d5db"
              strokeWidth="1"
              rx="4"
            />
            <text
              x={padding + data.indexOf(hoveredBar) * (barWidth + barSpacing) + barSpacing / 2}
              y={35}
              fill="#1f2937"
              fontSize="12"
              fontWeight="bold"
            >
              {hoveredBar.name}: {hoveredBar[dataKey]}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

// Pie Chart Component
export const PieChart: React.FC<PieChartProps> = ({
  data,
  height = 300,
  showTooltip = true,
}) => {
  const [hoveredSlice, setHoveredSlice] = React.useState<any>(null);

  const centerX = 400;
  const centerY = height / 2;
  const radius = Math.min(height / 2 - 40, 100);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  let cumulativePercentage = 0;
  const angles = data.map((item, index) => {
    const percentage = item.value / total;
    const startAngle = cumulativePercentage * 2 * Math.PI;
    const endAngle = (cumulativePercentage + percentage) * 2 * Math.PI;
    cumulativePercentage += percentage;

    const largeArcFlag = percentage > 0.5 ? 1 : 0;

    return {
      ...item,
      startAngle,
      endAngle,
      largeArcFlag,
      percentage,
      index,
    };
  });

  return (
    <div className="w-full flex justify-center" style={{ height: `${height}px` }}>
      <svg
        viewBox={`0 0 800 ${height}`}
        className="w-full h-full"
        onMouseMove={(e) => {
          if (!showTooltip) return;

          const rect = e.currentTarget.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          // Calculate angle from mouse position
          const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
          const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

          // Find which slice is hovered
          let currentAngle = 0;
          for (const slice of angles) {
            const midAngle = (slice.startAngle + slice.endAngle) / 2;
            const normalizedMidAngle = midAngle < 0 ? midAngle + 2 * Math.PI : midAngle;

            if (normalizedAngle >= currentAngle && normalizedAngle < normalizedAngle + slice.percentage * 2 * Math.PI) {
              setHoveredSlice(slice);
              return;
            }
            currentAngle += slice.percentage * 2 * Math.PI;
          }
        }}
        onMouseLeave={() => setHoveredSlice(null)}
      >
        {/* Pie slices */}
        {angles.map((slice) => {
          const isHovered = hoveredSlice === slice;
          const startX = centerX + radius * Math.cos(slice.startAngle);
          const startY = centerY + radius * Math.sin(slice.startAngle);
          const endX = centerX + radius * Math.cos(slice.endAngle);
          const endY = centerY + radius * Math.sin(slice.endAngle);

          const largeArcFlag = slice.largeArcFlag ? 1 : 0;
          const x = centerX + (radius + 10) * Math.cos((slice.startAngle + slice.endAngle) / 2);
          const y = centerY + (radius + 10) * Math.sin((slice.startAngle + slice.endAngle) / 2);

          return (
            <g key={slice.index}>
              {/* Slice */}
              <path
                d={`M ${centerX} ${centerY} L ${endX} ${endY} A ${radius} ${radius} 0 ${largeArcFlag} 1`}
                fill={slice.color || '#3b82f6'}
                stroke="white"
                strokeWidth="2"
                className={`cursor-pointer transition-all ${isHovered ? 'opacity-80' : 'hover:opacity-90'}`}
              />

              {/* Tooltip */}
              {isHovered && showTooltip && (
                <g>
                  <line
                    x1={centerX + radius * Math.cos((slice.startAngle + slice.endAngle) / 2)}
                    y1={centerY + radius * Math.sin((slice.startAngle + slice.endAngle) / 2)}
                    x2={x}
                    y2={y}
                    stroke="#1f2937"
                    strokeWidth="1"
                  />
                  <rect
                    x={x - 40}
                    y={y - 15}
                    width="80"
                    height="30"
                    fill="white"
                    stroke="#d1d5db"
                    strokeWidth="1"
                    rx="4"
                  />
                  <text
                    x={x}
                    y={y}
                    fill="#1f2937"
                    fontSize="14"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {slice.name}
                  </text>
                  <text
                    x={x}
                    y={y + 15}
                    fill="#6b7280"
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {Math.round(slice.percentage * 100)}%
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Progress Indicator Component
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value,
  max,
  color = '#3b82f6',
  showLabel = true,
  height = '2rem',
}) => {
  const percentage = Math.min(100, (value / max) * 100);

  const getColor = (percentage: number) => {
    if (percentage >= 90) return '#dc2626';
    if (percentage >= 75) return '#f59e0b';
    if (percentage >= 50) return '#eab308';
    return '#3b82f6';
  };

  const actualColor = color || getColor(percentage);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {value.toLocaleString()} / {max.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500">({percentage.toFixed(1)}%)</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-full">
        <div
          className="rounded-full h-full transition-all duration-300 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: actualColor,
            height,
          }}
        ></div>
      </div>
    </div>
  );
};