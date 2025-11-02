import React from 'react';
import { Transaction } from '../types';

interface ResultsTableProps {
  transactions: Transaction[];
}

const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const ResultsTable: React.FC<ResultsTableProps> = ({ transactions }) => {
  return (
    <div className="overflow-hidden border border-gray-200 rounded-2xl shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left font-medium text-gray-600 tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left font-medium text-gray-600 tracking-wider">Description</th>
              <th scope="col" className="px-6 py-3 text-right font-medium text-gray-600 tracking-wider">Debit</th>
              <th scope="col" className="px-6 py-3 text-right font-medium text-gray-600 tracking-wider">Credit</th>
              <th scope="col" className="px-6 py-3 text-right font-medium text-gray-600 tracking-wider">Balance</th>
              <th scope="col" className="px-6 py-3 text-left font-medium text-gray-600 tracking-wider">Source File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{tx.date}</td>
                <td className="px-6 py-4 whitespace-normal text-gray-800 max-w-xs">{tx.description}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-right font-mono ${tx.debit ? 'text-red-600' : 'text-gray-400'}`}>
                  {tx.debit ? `- ${formatCurrency(tx.debit)}` : ''}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-right font-mono ${tx.credit ? 'text-green-600' : 'text-gray-400'}`}>
                  {tx.credit ? `+ ${formatCurrency(tx.credit)}`: ''}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-700">{formatCurrency(tx.balance)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs truncate max-w-xs">{tx.sourceFile}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};