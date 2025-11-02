import { Type } from "@google/genai";

export const GEMINI_MODEL = "gemini-2.5-flash";

export const BANK_STATEMENT_PROMPT_FOR_IMAGES = `
Act as an expert financial data analyst. Your task is to extract transaction data from the provided images of a bank statement.
The data might be messy. Identify the columns for date, description, withdrawals/debits, deposits/credits, and the running balance.
Process all transactions listed and return them in the specified JSON format.
- 'debit' should be a positive number for money going out.
- 'credit' should be a positive number for money coming in.
- If a transaction is a debit, 'credit' should be null, and vice-versa.
- The balance should be the running balance after that specific transaction.
- Dates should be normalized to 'YYYY-MM-DD' format if possible, otherwise use the format from the text.
- Clean up the description text to be human-readable.
`;

export const FINANCIAL_INSIGHTS_PROMPT = `
You are a helpful and insightful financial assistant. Based on the following JSON array of bank transactions, provide a concise financial summary, 3-4 actionable insights, and a single, achievable savings goal.
- The summary should calculate total income (sum of credits), total spending (sum of debits), and the net cash flow (income - spending).
- The insights should highlight spending patterns, identify potential recurring subscriptions, or point out unusually large transactions. Be specific and helpful.
- The goal should be specific and based on the transaction data (e.g., 'Reduce spending on dining out by 15% this month.').
- Respond strictly in the requested JSON format.

Transactions:
`;

export const GOAL_PLANNER_PROMPT = `
You are an expert financial advisor AI. Your task is to create a personalized, actionable savings plan based on a user's financial goal and their transaction history.

**User's Goal:**
- Goal: {goalName}
- Target Amount: {targetAmount}
- Timeframe: {years} years

**User's Transaction History (JSON):**
{transactions}

**Your Task:**
1.  **Calculate Monthly Savings Target:** Determine the amount the user needs to save each month to reach their goal.
2.  **Analyze Spending:** Review the transaction history to identify top spending categories and areas for potential cutbacks.
3.  **Provide Actionable Suggestions:** Give 3-4 specific, data-driven suggestions for how the user can reduce spending to meet their monthly target (e.g., "You spent $250 on restaurants last month. Reducing this by 20% would save you $50.").
4.  **Create a Step-by-Step Plan:** Outline a simple, 3-step plan to help the user get started and stay on track.
5.  **Respond in JSON:** You must respond in the specified JSON format. Ensure all fields are populated with helpful, encouraging, and clear advice. The tone should be positive and empowering.
`;


export const TRANSACTION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: "Transaction date (YYYY-MM-DD)",
      },
      description: {
        type: Type.STRING,
        description: "A clean description of the transaction.",
      },
      debit: {
        type: Type.NUMBER,
        description: "The amount debited (withdrawal). Null if credit.",
      },
      credit: {
        type: Type.NUMBER,
        description: "The amount credited (deposit). Null if debit.",
      },
      balance: {
        type: Type.NUMBER,
        description: "The running balance after the transaction.",
      },
    },
    required: ["date", "description", "balance"],
  },
};

export const FINANCIAL_INSIGHTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        totalIncome: { type: Type.NUMBER },
        totalSpending: { type: Type.NUMBER },
        netFlow: { type: Type.NUMBER },
      },
      required: ["totalIncome", "totalSpending", "netFlow"],
    },
    insights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    goal: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ["title", "description"],
    },
  },
  required: ["summary", "insights", "goal"],
};

export const GOAL_PLANNER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    goalName: { type: Type.STRING },
    monthlySavingsTarget: { type: Type.NUMBER },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    plan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.INTEGER },
          action: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["step", "action", "description"],
      },
    },
  },
  required: ["goalName", "monthlySavingsTarget", "suggestions", "plan"],
};