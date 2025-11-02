import React from 'react';
import { FinancialInsights } from '../types';
import { ChartPieIcon } from './icons/ChartPieIcon';
import { LightBulbIcon } from './icons/LightBulbIcon';
import { TrophyIcon } from './icons/TrophyIcon';

interface InsightsViewProps {
  insights: FinancialInsights;
}

const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const Card: React.FC<{ icon: React.ReactNode, title: string, children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 shadow-sm border border-gray-200/50">
    <div className="flex items-center gap-3 mb-4">
      <div className="bg-blue-100 text-blue-600 rounded-lg p-2">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
    </div>
    <div>{children}</div>
  </div>
);

export const InsightsView: React.FC<InsightsViewProps> = ({ insights }) => {
  const { summary, insights: insightItems, goal } = insights;
  const netFlowColor = summary.netFlow >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* Summary Card */}
      <Card icon={<ChartPieIcon className="w-6 h-6" />} title="Financial Summary">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Income</span>
            <span className="font-semibold text-green-600">{formatCurrency(summary.totalIncome)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Spending</span>
            <span className="font-semibold text-red-600">{formatCurrency(summary.totalSpending)}</span>
          </div>
          <div className="border-t border-gray-200 my-2"></div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-semibold">Net Cash Flow</span>
            <span className={`font-bold text-lg ${netFlowColor}`}>{formatCurrency(summary.netFlow)}</span>
          </div>
        </div>
      </Card>
      
      {/* Insights Card */}
      <Card icon={<LightBulbIcon className="w-6 h-6" />} title="AI Insights">
        <ul className="space-y-3 text-sm text-gray-700 list-disc list-inside">
          {insightItems.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </Card>
      
      {/* Goal Card */}
      <Card icon={<TrophyIcon className="w-6 h-6" />} title="Suggested Goal">
        <div className="space-y-2">
          <p className="font-semibold text-gray-800">{goal.title}</p>
          <p className="text-sm text-gray-600">{goal.description}</p>
        </div>
      </Card>
    </div>
  );
};
