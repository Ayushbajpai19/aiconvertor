import React, { useState } from 'react';
import { GoalInput, GoalPlan } from '../types';
import { Button } from './Button';
import { TrophyIcon } from './icons/TrophyIcon';

interface GoalPlannerViewProps {
  onGetPlan: (goal: GoalInput) => Promise<GoalPlan>;
  existingPlan: GoalPlan | null;
}

const formatCurrency = (amount: number | null) => {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const GoalPlannerView: React.FC<GoalPlannerViewProps> = ({ onGetPlan, existingPlan }) => {
  const [goalInput, setGoalInput] = useState<GoalInput>({ goalName: '', targetAmount: 10000, years: 5 });
  const [plan, setPlan] = useState<GoalPlan | null>(existingPlan);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setPlan(null);
    try {
      const result = await onGetPlan(goalInput);
      setPlan(result);
    } catch (err: any) {
      setError(err.message || "Failed to generate a plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const inputStyles = "mt-1 block w-full rounded-lg border-transparent bg-gray-100/80 px-4 py-2.5 text-gray-800 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all";

  const renderPlan = () => {
    if (!plan) return null;
    return (
      <div className="mt-8 p-6 bg-white/70 backdrop-blur-lg rounded-2xl shadow-sm border border-gray-200/50 animate-fade-in">
        <div className="text-center border-b border-gray-200 pb-4 mb-4">
          <TrophyIcon className="w-12 h-12 text-yellow-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800 mt-2">Your Plan for: {plan.goalName}</h2>
        </div>
        
        <div className="text-center my-6">
          <p className="text-gray-600">Your Monthly Savings Target</p>
          <p className="text-4xl font-bold text-blue-600">{formatCurrency(plan.monthlySavingsTarget)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Personalized Suggestions</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
              {plan.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Your Action Plan</h3>
            <ol className="space-y-3 text-sm">
              {plan.plan.map(p => (
                <li key={p.step} className="flex">
                  <span className="flex-shrink-0 bg-blue-600 text-white rounded-full w-6 h-6 text-xs font-bold flex items-center justify-center mr-3">{p.step}</span>
                  <div>
                    <p className="font-semibold text-gray-700">{p.action}</p>
                    <p className="text-gray-600">{p.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-8 shadow-sm border border-gray-200/50">
        <h2 className="text-2xl font-bold text-gray-800 text-center">AI-Powered Goal Planner</h2>
        <p className="text-center text-gray-500 mt-2">Tell us your goal, and our AI will create a personalized savings plan based on your transaction history.</p>
        
        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="goalName" className="block text-sm font-medium text-gray-700">What are you saving for?</label>
            <input
              type="text"
              id="goalName"
              value={goalInput.goalName}
              onChange={e => setGoalInput({ ...goalInput, goalName: e.target.value })}
              className={inputStyles}
              placeholder="e.g., New Car"
              required
            />
          </div>
          <div>
            <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700">How much do you need?</label>
            <input
              type="number"
              id="targetAmount"
              value={goalInput.targetAmount}
              onChange={e => setGoalInput({ ...goalInput, targetAmount: Number(e.target.value) })}
              className={inputStyles}
              required
              min="1"
            />
          </div>
          <div>
            <label htmlFor="years" className="block text-sm font-medium text-gray-700">In how many years?</label>
            <input
              type="number"
              id="years"
              value={goalInput.years}
              onChange={e => setGoalInput({ ...goalInput, years: Number(e.target.value) })}
              className={inputStyles}
              required
              min="1"
            />
          </div>
          <div className="md:col-span-3 text-center mt-2">
            <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
              {isLoading ? 'Generating Plan...' : 'Create My Plan'}
            </Button>
          </div>
        </form>
      </div>

      {isLoading && (
        <div className="text-center mt-8">
          <div className="relative w-12 h-12 inline-block">
            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600 mt-2">AI is analyzing your finances...</p>
        </div>
      )}

      {error && <p className="text-red-600 text-center mt-4">{error}</p>}
      
      {plan && renderPlan()}
    </div>
  );
};
