// ============================================
// RAW TYPES - Match API response EXACTLY
// ============================================

export interface TransactionRaw {
  id: number;
  userId: number;
  type: "expense" | "income" | "transfer";
  category: string;
  subcategory: string | null;
  amount: string;
  description: string;
  merchant: string | null;
  accountType: string;
  date: string;
  goalId: number | null;
  investmentId: number | null;
  currency: string;
  isRecurring: boolean;
  recurringId: number | null;
  budgetCategory: string;
  createdAt: string;
}

export interface GoalRaw {
  id: number;
  userId: number;
  name: string;
  type: string;
  targetAmount: string;
  currentAmount: string;
  monthlyContribution: string;
  targetDate: string;
  priority: number;
  expectedReturn: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardDataRaw {
  netWorth: number;
  availableLiquidity: number;
  cashFlow: number;
  totalAssets: number;
  totalLiabilities: number;
  totalIncome: number;
  totalExpenses: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  availableMonthlyFlow: number;
  totalInvestments: number;
  assetsByType: any;
  goals: GoalRaw[];
  recentTransactions: TransactionRaw[];
  achievements: any[];
  progress: any[];
  recurringTransactions: any[];
}

export interface AccountArchitectureDataRaw {
  id: number;
  userId: number;
  monthlyIncome: string;
  autoDistributionEnabled: boolean;
  distributionDay: number;
  
  incomeAccountName: string;
  incomeAccountBankName: string;
  incomeAccountIban: string;
  incomeAccountBalance: string;
  
  wealthAccountName: string;
  wealthAccountBankName: string;
  wealthAccountIban: string;
  wealthAccountBalance: string;
  wealthMonthlyAllocation: string;
  
  operatingAccountName: string;
  operatingAccountBankName: string;
  operatingAccountIban: string;
  operatingAccountBalance: string;
  operatingMonthlyAllocation: string;
  
  emergencyAccountName: string;
  emergencyAccountBankName: string;
  emergencyAccountIban: string;
  emergencyAccountBalance: string;
  emergencyTargetAmount: string;
  emergencyMonthlyAllocation: string;
  
  investmentAccountName: string;
  investmentAccountBankName: string;
  investmentAccountIban: string;
  investmentAccountBalance: string;
  investmentMonthlyAllocation: string;
  
  savingsAccountName: string;
  savingsAccountBankName: string;
  savingsAccountIban: string;
  savingsAccountBalance: string;
  savingsMonthlyAllocation: string;
  
  subAccounts: any[];
}

export interface CategoryBudgetRaw {
  id: number;
  userId: number;
  category: string;
  subcategory: string | null;
  monthlyBudget: string;
  budgetType: "needs" | "wants";
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CategoryBudgetsDataRaw = CategoryBudgetRaw[];

export type TransactionsDataRaw = TransactionRaw[];

export interface BudgetSettingsDataRaw {
  id: number;
  userId: number;
  needsPercentage: string;
  wantsPercentage: string;
  savingsPercentage: string;
  monthlyIncome: string;
  customCategories: any;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentRaw {
  id: number;
  userId: number;
  name: string;
  value: string;
  purchaseValue: string;
  return: string;
  returnAmount: string;
  type: string;
}

export type InvestmentsDataRaw = InvestmentRaw[];

export type GoalsDataRaw = GoalRaw[];

// ============================================
// NORMALIZED TYPES - For AI consumption
// ============================================

export interface Account {
  name: string;
  bank: string;
  balance: number;
  type: "income" | "wealth" | "operating" | "emergency" | "investment" | "savings";
  iban: string;
  monthlyAllocation?: number;
}

export interface AccountsData {
  accounts: Account[];
  totalLiquidity: number;
}

export interface DashboardData {
  netWorth: number;
  availableLiquidity: number;
  totalIncome: number;
  totalExpenses: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  availableMonthlyFlow: number;
}

export interface CategoryBudget {
  category: string;
  budgetAmount: number;
  budgetType: "needs" | "wants";
  spentAmount: number;
  percentage: number;
  status: "on_track" | "exceeded" | "under_budget";
}

export interface CategoryBudgetsData {
  budgets: CategoryBudget[];
  totalBudgeted: number;
  totalSpent: number;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  subcategory: string | null;
  account: string;
  type: "income" | "expense" | "transfer";
  currency: string;
}

export interface TransactionsData {
  transactions: Transaction[];
  totalCount: number;
}

export interface BudgetSettingsData {
  monthlyIncome: number;
  needsPercentage: number;
  wantsPercentage: number;
  savingsPercentage: number;
}

export interface Investment {
  id: string;
  name: string;
  value: number;
  purchaseValue: number;
  return: number;
  returnAmount: number;
  type: string;
}

export interface InvestmentsData {
  investments: Investment[];
  totalValue: number;
  totalReturn: number;
  totalReturnAmount: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  monthlyContribution: number;
  status: "on_track" | "behind" | "ahead" | "completed";
}

export interface GoalsData {
  goals: Goal[];
  totalGoalsAmount: number;
  totalSavedAmount: number;
  completedGoals: number;
  activeGoals: number;
}

export interface FinanceData {
  dashboard?: DashboardData;
  budgets?: CategoryBudgetsData;
  budgetsByMonth?: Record<string, any[]>;
  transactions?: TransactionsData;
  accounts?: AccountsData;
  budgetSettings?: BudgetSettingsData;
  investments?: InvestmentsData;
  goals?: GoalsData;
  multiMonthAnalysis?: any;
}

export * from "./percorso-capitale-processor";
