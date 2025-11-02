import { GoogleGenAI } from "@google/genai";
import { Transaction, FinancialInsights, GoalInput, GoalPlan } from '../types';
import { 
  GEMINI_MODEL, 
  BANK_STATEMENT_PROMPT_FOR_IMAGES, 
  TRANSACTION_SCHEMA, 
  FINANCIAL_INSIGHTS_PROMPT, 
  FINANCIAL_INSIGHTS_SCHEMA,
  GOAL_PLANNER_PROMPT,
  GOAL_PLANNER_SCHEMA
} from '../constants';

const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY environment variable not set.");
    throw new Error("API key is not configured. Please contact support.");
  }
  return apiKey;
}

export async function extractTransactions(pdfImages: string[], sourceFile: string): Promise<Transaction[]> {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const imageParts = pdfImages.map(base64Img => ({
      inlineData: {
        mimeType: 'image/png',
        data: base64Img.substring(base64Img.indexOf(',') + 1) // remove the 'data:image/png;base64,' prefix
      }
    }));

    const allParts = [
      { text: BANK_STATEMENT_PROMPT_FOR_IMAGES },
      ...imageParts
    ];

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts: allParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: TRANSACTION_SCHEMA,
      },
    });
    
    const jsonText = response.text.trim();
    const parsedTransactions: Omit<Transaction, 'sourceFile'>[] = JSON.parse(jsonText);
    
    const transactionsWithSource = parsedTransactions.map(tx => ({
      ...tx,
      sourceFile,
    }));

    return transactionsWithSource;
  } catch (error) {
    console.error(`Error processing statement for ${sourceFile} with Gemini:`, error);
    throw new Error("Failed to analyze the document. The format may be unsupported or the AI could not process the content.");
  }
}

export async function getFinancialInsights(transactions: Transaction[]): Promise<FinancialInsights> {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const transactionsJson = JSON.stringify(transactions.map(({sourceFile, ...rest}) => rest), null, 2); // Omit sourceFile for AI analysis

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${FINANCIAL_INSIGHTS_PROMPT}\n${transactionsJson}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: FINANCIAL_INSIGHTS_SCHEMA,
      },
    });

    const jsonText = response.text.trim();
    const insights: FinancialInsights = JSON.parse(jsonText);

    return insights;

  } catch (error) {
    console.error("Error generating financial insights with Gemini:", error);
    throw new Error("Failed to generate AI insights. Please try again.");
  }
}

export async function getGoalPlan(transactions: Transaction[], goal: GoalInput): Promise<GoalPlan> {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const transactionsJson = JSON.stringify(transactions.map(({ sourceFile, ...rest }) => rest), null, 2);

    let prompt = GOAL_PLANNER_PROMPT;
    prompt = prompt.replace('{goalName}', goal.goalName);
    prompt = prompt.replace('{targetAmount}', goal.targetAmount.toString());
    prompt = prompt.replace('{years}', goal.years.toString());
    prompt = prompt.replace('{transactions}', transactionsJson);

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: GOAL_PLANNER_SCHEMA,
      },
    });
    
    const jsonText = response.text.trim();
    const plan: GoalPlan = JSON.parse(jsonText);

    return plan;
  } catch (error) {
    console.error("Error generating goal plan with Gemini:", error);
    throw new Error("Failed to generate AI goal plan. Please try again.");
  }
}