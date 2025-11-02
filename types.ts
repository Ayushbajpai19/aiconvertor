export interface Transaction {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  sourceFile: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalSpending: number;
  netFlow: number;
}

export interface FinancialGoal {
  title: string;
  description: string;
}

export interface FinancialInsights {
  summary: FinancialSummary;
  insights: string[];
  goal: FinancialGoal;
}

export type FileStatus = 'pending' | 'needsPassword' | 'ready' | 'processing' | 'success' | 'error';

export interface FileState {
  id: string;
  file: File;
  status: FileStatus;
  password?: string;
  errorMessage?: string;
}


export enum AppState {
  IDLE,
  FILES_SELECTED,
  PROCESSING,
  SUCCESS,
  ERROR,
}

export enum View {
  TRANSACTIONS,
  INSIGHTS,
  GOAL_PLANNER,
}

export interface GoalInput {
  goalName: string;
  targetAmount: number;
  years: number;
}

export interface GoalPlan {
  goalName: string;
  monthlySavingsTarget: number;
  suggestions: string[];
  plan: {
    step: number;
    action: string;
    description: string;
  }[];
}