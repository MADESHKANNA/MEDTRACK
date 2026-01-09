
import React from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { OccupancyLog } from '../types';

interface OccupancyChartProps {
  data: OccupancyLog[];
}

const OccupancyChart: React.FC<OccupancyChartProps> = ({ data }) => {
  // Add derived occupancy rate for the line chart
  const chartData = data.map(item => ({
    ...item,
    occupancyRate: Math.round((item.occupied / item.total) * 100)
  }));

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="timestamp" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} 
            dy={10}
          />
          <YAxis 
            yAxisId="left"
            axisLine={false} 
            tickLine={false} 
            domain={[0, 100]}
            tick={{ fill: '#3b82f6', fontSize: 11, fontWeight: 600 }} 
            tickFormatter={(value) => `${value}%`}
            label={{ value: 'Occupancy Rate', angle: -90, position: 'insideLeft', style: { fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' }, dx: -10 }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#10b981', fontSize: 11, fontWeight: 600 }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            label={{ value: 'Revenue', angle: 90, position: 'insideRight', style: { fill: '#10b981', fontSize: 10, fontWeight: 'bold' }, dx: 10 }}
          />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              padding: '12px',
              fontSize: '12px'
            }}
            cursor={{ fill: '#f8fafc' }}
            formatter={(value, name) => [
              name === 'Daily Revenue' ? `₹${Number(value).toLocaleString()}` : `${value}%`,
              name
            ]}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          />
          <Bar 
            yAxisId="right"
            dataKey="revenue" 
            name="Daily Revenue" 
            fill="#10b981" 
            radius={[4, 4, 0, 0]}
            barSize={40}
            opacity={0.8}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="occupancyRate" 
            name="Occupancy %" 
            stroke="#3b82f6" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OccupancyChart;
