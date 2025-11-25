import type {
  DashboardDataRaw,
  CategoryBudgetsDataRaw,
  TransactionsDataRaw,
  AccountArchitectureDataRaw,
  BudgetSettingsDataRaw,
  InvestmentsDataRaw,
  GoalsDataRaw,
  TransactionRaw,
  CategoryBudgetRaw,
  GoalRaw,
  InvestmentRaw,
} from "./percorso-capitale-types";

export interface ProcessedDashboardData {
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
  goals: any[];
  recentTransactions: any[];
  achievements: any[];
  progress: any[];
  recurringTransactions: any[];
  
  savingsRate: number;
  savingsRateFormatted: string;
  debtToAssetRatio: number;
  debtToAssetRatioFormatted: string;
  debtToAssetStatus: string;
  liquidityPercentage: number | null;
  liquidityPercentageFormatted: string | null;
  assetBreakdown: Record<string, {
    value: number;
    percentage: number;
    percentageFormatted: string;
  }>;
  totalLiquidity: number;
  cashFlowConsistency: {
    calculated: number;
    fromAPI: number;
    monthlyFlowFromAPI: number;
    isConsistent: boolean;
    warnings: string[];
  };
  recentTransactionsStats: {
    count: number;
    average: string;
    median: string;
    min: string;
    max: string;
  } | null;
}

export interface ProcessedAccountArchitecture {
  raw: AccountArchitectureDataRaw;
  
  totalAllocations: number;
  totalAllocationsFormatted: string;
  allocationPercentage: number;
  allocationConsistency: {
    isValid: boolean;
    difference: number;
    warnings: string[];
  };
  
  accountsWithAllocations: Array<{
    name: string;
    type: string;
    allocation: number;
    balance: number;
    allocationPercentage: number;
    allocationPercentageFormatted: string;
    target?: number;
  }>;
  
  emergencyFundProgress: {
    current: string;
    target: string;
    remaining: string;
    progress: string;
    monthsToTarget: number | string;
    estimatedCompletionDate: string | null;
    status: string;
  };
  
  subAccountsAnalysis: Array<{
    id: number;
    name: string;
    current: string;
    target: string;
    remaining: string;
    progress: string;
    monthlyAllocation: string;
    monthsRemaining: number | string;
    priority: number;
    status: string;
  }>;
  
  totalBalance: number;
}

export interface ProcessedCategoryBudget extends CategoryBudgetRaw {
  spent: string;
  remaining: string;
  percentage: string;
  percentageFormatted: string;
  status: 'no-budget' | 'over' | 'warning' | 'excellent' | 'ok';
  statusIcon: string;
  transactionCount: number;
  transactions: TransactionRaw[];
  daysInMonth: number;
  currentDay: number;
  dailyBudget: string;
  dailyAverage: string;
  projectedEndOfMonth: string;
}

export interface ProcessedGoal extends GoalRaw {
  progress: string;
  remaining: string;
  daysRemaining: number;
  monthsRemaining: string;
  monthlyRequired: string;
  status: 'completed' | 'overdue' | 'on-track' | 'needs-attention' | 'critical';
  isOverdue: boolean;
  isCompleted: boolean;
}

export interface ProcessedInvestment extends InvestmentRaw {
  totalInvested: string;
  currentValue: string;
  gainLoss: string;
  gainLossPercent: string;
  performance: 'profit' | 'loss';
  performanceIcon: string;
}

export interface MonthlyTrend {
  month: string;
  monthLabel: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  budgetSpent: number;
  budgetTotal: number;
  budgetPercentage: number;
}

export interface MultiMonthAnalysis {
  months: MonthlyTrend[];
  averages: {
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
  };
  trends: {
    incomeChange: string;
    expensesChange: string;
    savingsChange: string;
    direction: 'improving' | 'declining' | 'stable';
  };
  bestMonth: {
    month: string;
    savingsRate: number;
  };
  worstMonth: {
    month: string;
    savingsRate: number;
  };
}

export class PercorsoCapitaleDataProcessor {
  
  private static getMonthLabel(monthString: string): string {
    const [year, month] = monthString.split('-');
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const monthIndex = parseInt(month) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  }

  private static getMonthsArray(count: number): string[] {
    const months: string[] = [];
    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      // Fix timezone drift: manual string construction invece di toISOString()
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthString = `${year}-${month}`;
      months.push(monthString);
    }
    
    return months;
  }

  static analyzeMultipleMonths(
    transactions: TransactionRaw[],
    categoryBudgets: CategoryBudgetRaw[],
    monthCount: number = 6
  ): MultiMonthAnalysis {
    const months = this.getMonthsArray(monthCount);
    const monthlyData: MonthlyTrend[] = [];
    
    // DEBUG: Log distribuzione date transazioni
    if (transactions.length > 0) {
      const dates = transactions.map(t => t.date).filter(Boolean).sort();
      console.log(`📊 [MultiMonth] Analyzing ${transactions.length} transactions`);
      console.log(`📅 [MultiMonth] Date range: ${dates[0]} → ${dates[dates.length - 1]}`);
      console.log(`📅 [MultiMonth] Target months: ${months.join(', ')}`);
    }

    months.forEach(month => {
      const monthTransactions = this.filterTransactionsByPeriod(transactions, 'custom-month', month);
      
      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
      
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
      
      const savings = income - expenses;
      const savingsRate = income > 0 ? (savings / income) * 100 : 0;

      const processedBudgets = this.processCategoryBudgets(categoryBudgets, transactions, month);
      const budgetSpent = processedBudgets.reduce((sum, b) => sum + parseFloat(b.spent), 0);
      const budgetTotal = processedBudgets.reduce((sum, b) => sum + parseFloat(b.monthlyBudget), 0);
      const budgetPercentage = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;

      monthlyData.push({
        month,
        monthLabel: this.getMonthLabel(month),
        income,
        expenses,
        savings,
        savingsRate,
        budgetSpent,
        budgetTotal,
        budgetPercentage,
      });
    });

    const avgIncome = monthlyData.reduce((sum, m) => sum + m.income, 0) / monthlyData.length;
    const avgExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0) / monthlyData.length;
    const avgSavings = monthlyData.reduce((sum, m) => sum + m.savings, 0) / monthlyData.length;
    const avgSavingsRate = monthlyData.reduce((sum, m) => sum + m.savingsRate, 0) / monthlyData.length;

    const firstMonthIncome = monthlyData[0]?.income || 0;
    const lastMonthIncome = monthlyData[monthlyData.length - 1]?.income || 0;
    const incomeChange = firstMonthIncome > 0 ? ((lastMonthIncome - firstMonthIncome) / firstMonthIncome * 100) : 0;

    const firstMonthExpenses = monthlyData[0]?.expenses || 0;
    const lastMonthExpenses = monthlyData[monthlyData.length - 1]?.expenses || 0;
    const expensesChange = firstMonthExpenses > 0 ? ((lastMonthExpenses - firstMonthExpenses) / firstMonthExpenses * 100) : 0;

    const firstMonthSavings = monthlyData[0]?.savings || 0;
    const lastMonthSavings = monthlyData[monthlyData.length - 1]?.savings || 0;
    const savingsChange = firstMonthSavings !== 0 ? ((lastMonthSavings - firstMonthSavings) / Math.abs(firstMonthSavings) * 100) : 0;

    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    if (savingsChange > 10) {
      direction = 'improving';
    } else if (savingsChange < -10) {
      direction = 'declining';
    }

    const sortedByRate = [...monthlyData].sort((a, b) => b.savingsRate - a.savingsRate);
    const bestMonth = sortedByRate[0] || monthlyData[0];
    const worstMonth = sortedByRate[sortedByRate.length - 1] || monthlyData[0];

    return {
      months: monthlyData,
      averages: {
        income: avgIncome,
        expenses: avgExpenses,
        savings: avgSavings,
        savingsRate: avgSavingsRate,
      },
      trends: {
        incomeChange: incomeChange.toFixed(2) + '%',
        expensesChange: expensesChange.toFixed(2) + '%',
        savingsChange: savingsChange.toFixed(2) + '%',
        direction,
      },
      bestMonth: {
        month: bestMonth.monthLabel,
        savingsRate: bestMonth.savingsRate,
      },
      worstMonth: {
        month: worstMonth.monthLabel,
        savingsRate: worstMonth.savingsRate,
      },
    };
  }
  
  static processDashboard(data: DashboardDataRaw): ProcessedDashboardData {
    const monthlyIncome = data.monthlyIncome || 0;
    const monthlyExpenses = data.monthlyExpenses || 0;
    const totalAssets = data.totalAssets || 0;
    const totalLiabilities = data.totalLiabilities || 0;
    const netWorth = data.netWorth || 0;
    const availableLiquidity = data.availableLiquidity || 0;
    const cashFlow = data.cashFlow || 0;
    const availableMonthlyFlow = data.availableMonthlyFlow || 0;

    let savingsRate = 0;
    if (monthlyIncome === 0 || monthlyIncome === null) {
      savingsRate = 0;
    } else {
      savingsRate = ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100;
      if (savingsRate < 0) {
        savingsRate = Math.abs(savingsRate);
      }
      if (savingsRate > 100) {
        savingsRate = 100;
      }
    }

    let debtToAssetRatio = 0;
    if (totalAssets === 0 || totalAssets === null) {
      debtToAssetRatio = totalLiabilities > 0 ? 100 : 0;
    } else {
      debtToAssetRatio = (totalLiabilities / totalAssets) * 100;
    }

    let debtToAssetStatus = '';
    if (debtToAssetRatio > 50) {
      debtToAssetStatus = '⚠️ Alto indebitamento';
    } else if (debtToAssetRatio > 30) {
      debtToAssetStatus = '⚡ Moderato indebitamento';
    } else {
      debtToAssetStatus = '✅ Basso indebitamento';
    }

    let liquidityPercentage: number | null = null;
    let liquidityPercentageFormatted: string | null = null;
    if (netWorth === 0) {
      liquidityPercentage = 0;
      liquidityPercentageFormatted = '0.00';
    } else if (netWorth < 0) {
      liquidityPercentage = null;
      liquidityPercentageFormatted = null;
    } else {
      liquidityPercentage = (availableLiquidity / netWorth) * 100;
      liquidityPercentageFormatted = liquidityPercentage.toFixed(2);
    }

    const assetBreakdown: Record<string, { value: number; percentage: number; percentageFormatted: string }> = {};
    if (data.assetsByType && typeof data.assetsByType === 'object') {
      Object.entries(data.assetsByType).forEach(([type, value]) => {
        const numValue = typeof value === 'number' ? value : parseFloat(value as string) || 0;
        assetBreakdown[type] = {
          value: numValue,
          percentage: totalAssets > 0 ? (numValue / totalAssets) * 100 : 0,
          percentageFormatted: totalAssets > 0 ? ((numValue / totalAssets) * 100).toFixed(2) : '0.00',
        };
      });
    }

    const totalLiquidity = 
      (assetBreakdown.liquidity?.value || 0) + 
      (assetBreakdown.liquidità?.value || 0);

    const cashFlowCalculated = monthlyIncome - monthlyExpenses;
    const warnings: string[] = [];
    if (Math.abs(cashFlowCalculated - cashFlow) > 0.01) {
      warnings.push(`⚠️ INCOERENZA: Cash flow calcolato (${cashFlowCalculated.toFixed(2)}) diverso da API (${cashFlow.toFixed(2)})`);
    }
    if (Math.abs(cashFlow - availableMonthlyFlow) > 0.01) {
      warnings.push(`⚠️ INCOERENZA: cashFlow (${cashFlow.toFixed(2)}) ≠ availableMonthlyFlow (${availableMonthlyFlow.toFixed(2)})`);
    }

    let recentTransactionsStats: {
      count: number;
      average: string;
      median: string;
      min: string;
      max: string;
    } | null = null;

    if (data.recentTransactions && Array.isArray(data.recentTransactions) && data.recentTransactions.length > 0) {
      const amounts = data.recentTransactions.map(tx => Math.abs(parseFloat(tx.amount)));
      const total = amounts.reduce((sum, amt) => sum + amt, 0);
      const average = total / amounts.length;
      
      const sorted = [...amounts].sort((a, b) => a - b);
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
      
      const min = Math.min(...sorted);
      const max = Math.max(...sorted);

      recentTransactionsStats = {
        count: data.recentTransactions.length,
        average: average.toFixed(2),
        median: median.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
      };
    }

    return {
      ...data,
      savingsRate,
      savingsRateFormatted: savingsRate.toFixed(2),
      debtToAssetRatio,
      debtToAssetRatioFormatted: debtToAssetRatio.toFixed(2),
      debtToAssetStatus,
      liquidityPercentage,
      liquidityPercentageFormatted,
      assetBreakdown,
      totalLiquidity,
      cashFlowConsistency: {
        calculated: cashFlowCalculated,
        fromAPI: cashFlow,
        monthlyFlowFromAPI: availableMonthlyFlow,
        isConsistent: warnings.length === 0,
        warnings,
      },
      recentTransactionsStats,
    };
  }

  static processAccountArchitecture(data: AccountArchitectureDataRaw): ProcessedAccountArchitecture {
    const monthlyIncome = parseFloat(data.monthlyIncome || '0');
    
    let totalAllocations = 
      parseFloat(data.wealthMonthlyAllocation || '0') +
      parseFloat(data.operatingMonthlyAllocation || '0') +
      parseFloat(data.emergencyMonthlyAllocation || '0') +
      parseFloat(data.investmentMonthlyAllocation || '0') +
      parseFloat(data.savingsMonthlyAllocation || '0');

    if (data.subAccounts && Array.isArray(data.subAccounts)) {
      data.subAccounts.forEach(sub => {
        totalAllocations += parseFloat(sub.monthlyAllocation || '0');
      });
    }

    const allocationPercentage = monthlyIncome > 0 ? (totalAllocations / monthlyIncome) * 100 : 0;
    const warnings: string[] = [];
    
    if (Math.abs(totalAllocations - monthlyIncome) > 0.01) {
      warnings.push('🚨 ERRORE ARCHITETTURA: Allocazioni NON corrispondono al reddito!');
      warnings.push(`Totale allocazioni: ${totalAllocations.toFixed(2)}`);
      warnings.push(`Reddito mensile: ${monthlyIncome.toFixed(2)}`);
      warnings.push(`Differenza: ${(monthlyIncome - totalAllocations).toFixed(2)}`);
    }

    const accountsWithAllocations = [
      {
        name: data.wealthAccountName || 'Wealth',
        bankName: data.wealthAccountBankName || '',
        iban: data.wealthAccountIban || '',
        type: 'wealth',
        allocation: parseFloat(data.wealthMonthlyAllocation || '0'),
        balance: parseFloat(data.wealthAccountBalance || '0'),
        allocationPercentage: monthlyIncome > 0 ? (parseFloat(data.wealthMonthlyAllocation || '0') / monthlyIncome) * 100 : 0,
        allocationPercentageFormatted: monthlyIncome > 0 ? ((parseFloat(data.wealthMonthlyAllocation || '0') / monthlyIncome) * 100).toFixed(2) + '%' : '0.00%',
      },
      {
        name: data.operatingAccountName || 'Operating',
        bankName: data.operatingAccountBankName || '',
        iban: data.operatingAccountIban || '',
        type: 'operating',
        allocation: parseFloat(data.operatingMonthlyAllocation || '0'),
        balance: parseFloat(data.operatingAccountBalance || '0'),
        allocationPercentage: monthlyIncome > 0 ? (parseFloat(data.operatingMonthlyAllocation || '0') / monthlyIncome) * 100 : 0,
        allocationPercentageFormatted: monthlyIncome > 0 ? ((parseFloat(data.operatingMonthlyAllocation || '0') / monthlyIncome) * 100).toFixed(2) + '%' : '0.00%',
      },
      {
        name: data.emergencyAccountName || 'Emergency',
        bankName: data.emergencyAccountBankName || '',
        iban: data.emergencyAccountIban || '',
        type: 'emergency',
        allocation: parseFloat(data.emergencyMonthlyAllocation || '0'),
        balance: parseFloat(data.emergencyAccountBalance || '0'),
        target: parseFloat(data.emergencyTargetAmount || '0'),
        allocationPercentage: monthlyIncome > 0 ? (parseFloat(data.emergencyMonthlyAllocation || '0') / monthlyIncome) * 100 : 0,
        allocationPercentageFormatted: monthlyIncome > 0 ? ((parseFloat(data.emergencyMonthlyAllocation || '0') / monthlyIncome) * 100).toFixed(2) + '%' : '0.00%',
      },
      {
        name: data.investmentAccountName || 'Investment',
        bankName: data.investmentAccountBankName || '',
        iban: data.investmentAccountIban || '',
        type: 'investment',
        allocation: parseFloat(data.investmentMonthlyAllocation || '0'),
        balance: parseFloat(data.investmentAccountBalance || '0'),
        allocationPercentage: monthlyIncome > 0 ? (parseFloat(data.investmentMonthlyAllocation || '0') / monthlyIncome) * 100 : 0,
        allocationPercentageFormatted: monthlyIncome > 0 ? ((parseFloat(data.investmentMonthlyAllocation || '0') / monthlyIncome) * 100).toFixed(2) + '%' : '0.00%',
      },
      {
        name: data.savingsAccountName || 'Savings',
        bankName: data.savingsAccountBankName || '',
        iban: data.savingsAccountIban || '',
        type: 'savings',
        allocation: parseFloat(data.savingsMonthlyAllocation || '0'),
        balance: parseFloat(data.savingsAccountBalance || '0'),
        allocationPercentage: monthlyIncome > 0 ? (parseFloat(data.savingsMonthlyAllocation || '0') / monthlyIncome) * 100 : 0,
        allocationPercentageFormatted: monthlyIncome > 0 ? ((parseFloat(data.savingsMonthlyAllocation || '0') / monthlyIncome) * 100).toFixed(2) + '%' : '0.00%',
      },
    ];

    const emergencyBalance = parseFloat(data.emergencyAccountBalance || '0');
    const emergencyTarget = parseFloat(data.emergencyTargetAmount || '0');
    const emergencyMonthly = parseFloat(data.emergencyMonthlyAllocation || '0');
    
    const emergencyProgress = emergencyTarget > 0 ? (emergencyBalance / emergencyTarget) * 100 : 0;
    const emergencyRemaining = emergencyTarget - emergencyBalance;
    const monthsToTarget = emergencyMonthly > 0
      ? Math.ceil(emergencyRemaining / emergencyMonthly)
      : Infinity;
    
    const targetDate = emergencyMonthly > 0 && monthsToTarget !== Infinity
      ? new Date(Date.now() + (monthsToTarget * 30 * 24 * 60 * 60 * 1000))
      : null;

    let emergencyStatus = '';
    if (emergencyProgress >= 100) {
      emergencyStatus = '✅ Completato';
    } else if (emergencyProgress >= 75) {
      emergencyStatus = '🟢 Quasi completo';
    } else if (emergencyProgress >= 50) {
      emergencyStatus = '🟡 A metà strada';
    } else if (emergencyProgress >= 25) {
      emergencyStatus = '🟠 In corso';
    } else {
      emergencyStatus = '🔴 Iniziale';
    }

    const emergencyFundProgress = {
      current: emergencyBalance.toFixed(2),
      target: emergencyTarget.toFixed(2),
      remaining: emergencyRemaining.toFixed(2),
      progress: emergencyProgress.toFixed(2) + '%',
      monthsToTarget: monthsToTarget === Infinity ? '∞' : monthsToTarget,
      estimatedCompletionDate: targetDate ? targetDate.toISOString().slice(0, 10) : null,
      status: emergencyStatus,
    };

    const subAccountsAnalysis = data.subAccounts && Array.isArray(data.subAccounts)
      ? data.subAccounts.map(sub => {
          const current = parseFloat(sub.currentBalance || '0');
          const target = parseFloat(sub.targetAmount || '0');
          const monthly = parseFloat(sub.monthlyAllocation || '0');
          
          const progress = target > 0 ? (current / target) * 100 : 0;
          const remaining = target - current;
          const monthsToTarget = monthly > 0 ? Math.ceil(remaining / monthly) : Infinity;
          
          return {
            id: sub.id,
            name: sub.name,
            current: current.toFixed(2),
            target: target.toFixed(2),
            remaining: remaining.toFixed(2),
            progress: progress.toFixed(2) + '%',
            monthlyAllocation: monthly.toFixed(2),
            monthsRemaining: monthsToTarget === Infinity ? '∞' : monthsToTarget,
            priority: sub.priority,
            status: progress >= 100 ? 'Completato' : 'In corso',
          };
        }).sort((a, b) => a.priority - b.priority)
      : [];

    const totalBalance = 
      parseFloat(data.incomeAccountBalance || '0') +
      parseFloat(data.wealthAccountBalance || '0') +
      parseFloat(data.operatingAccountBalance || '0') +
      parseFloat(data.emergencyAccountBalance || '0') +
      parseFloat(data.investmentAccountBalance || '0') +
      parseFloat(data.savingsAccountBalance || '0');

    return {
      raw: data,
      totalAllocations,
      totalAllocationsFormatted: totalAllocations.toFixed(2),
      allocationPercentage,
      allocationConsistency: {
        isValid: warnings.length === 0,
        difference: monthlyIncome - totalAllocations,
        warnings,
      },
      accountsWithAllocations,
      emergencyFundProgress,
      subAccountsAnalysis,
      totalBalance,
    };
  }

  static filterTransactionsByPeriod(
    transactions: TransactionRaw[],
    filter: 'current-month' | 'custom-month' | 'date-range' | 'all-time',
    customMonth?: string,
    customDateRange?: { start: string; end: string }
  ): TransactionRaw[] {
    if (!transactions || !Array.isArray(transactions)) return [];

    let filtered = transactions.filter(t =>
      (t.type === 'expense' || t.type === 'income' || t.type === 'transfer') &&
      !t.description?.includes('Vendita investimento')
    );

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);

    switch (filter) {
      case 'current-month':
        filtered = filtered.filter(t => {
          if (!t.date) return false;
          const txDate = t.date.slice(0, 7);
          return txDate === currentMonth;
        });
        break;
      
      case 'custom-month':
        if (customMonth) {
          // Normalizza il formato del mese (YYYY-MM)
          const targetMonth = customMonth.slice(0, 7);
          filtered = filtered.filter(t => {
            if (!t.date) return false;
            const txDate = t.date.slice(0, 7);
            return txDate === targetMonth;
          });
          
          // Debug log per vedere quante transazioni abbiamo trovato
          console.log(`🔍 [FilterTransactions] Filtering for month ${targetMonth}:`);
          console.log(`   - Total transactions before filter: ${transactions.length}`);
          console.log(`   - Transactions after type filter: ${transactions.filter(t => (t.type === 'expense' || t.type === 'income' || t.type === 'transfer') && !t.description?.includes('Vendita investimento')).length}`);
          console.log(`   - Transactions matching month: ${filtered.length}`);
          if (filtered.length > 0) {
            console.log(`   - Date range: ${filtered[0].date} → ${filtered[filtered.length - 1].date}`);
          }
        }
        break;
      
      case 'date-range':
        if (customDateRange && customDateRange.start && customDateRange.end) {
          filtered = filtered.filter(t => {
            if (!t.date) return false;
            return t.date >= customDateRange.start && t.date <= customDateRange.end;
          });
        }
        break;
      
      case 'all-time':
      default:
        break;
    }

    return filtered;
  }

  static processCategoryBudgets(
    categoryBudgets: CategoryBudgetsDataRaw,
    transactions: TransactionsDataRaw,
    month?: string
  ): ProcessedCategoryBudget[] {
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const monthTransactions = transactions.filter(t =>
      t.date &&
      t.date.startsWith(targetMonth) &&
      t.type === 'expense'
    );
    
    console.log(`📊 [ProcessBudgets] Month ${targetMonth}: Found ${monthTransactions.length} expense transactions`);

    const spentByCategory: Record<string, { total: number; transactions: TransactionRaw[] }> = {};
    monthTransactions.forEach(t => {
      const cat = t.category || 'Altro';
      if (!spentByCategory[cat]) {
        spentByCategory[cat] = {
          total: 0,
          transactions: [],
        };
      }
      spentByCategory[cat].total += Math.abs(parseFloat(t.amount));
      spentByCategory[cat].transactions.push(t);
    });

    const budgetsWithSpent: ProcessedCategoryBudget[] = categoryBudgets.map(budget => {
      const budgetAmount = parseFloat(budget.monthlyBudget);
      const spent = spentByCategory[budget.category]?.total || 0;
      const remaining = budgetAmount - spent;
      const percentage = budgetAmount > 0 ? (spent / budgetAmount * 100) : 0;

      let status: 'no-budget' | 'over' | 'warning' | 'excellent' | 'ok';
      if (budgetAmount === 0) {
        status = 'no-budget';
      } else if (percentage > 100) {
        status = 'over';
      } else if (percentage > 90) {
        status = 'warning';
      } else if (percentage < 10) {
        status = 'excellent';
      } else {
        status = 'ok';
      }

      const statusIcon = 
        status === 'over' ? '🔴' :
        status === 'warning' ? '🟡' :
        status === 'excellent' ? '🟢' : '⚪';

      const [year, monthNum] = targetMonth.split('-').map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      const currentDay = new Date().getDate();
      const dailyBudget = budgetAmount / daysInMonth;
      const dailyAverage = spentByCategory[budget.category]?.transactions.length > 0
        ? spent / currentDay
        : 0;
      const projectedEndOfMonth = dailyAverage * daysInMonth;

      return {
        ...budget,
        spent: spent.toFixed(2),
        remaining: remaining.toFixed(2),
        percentage: percentage.toFixed(2),
        percentageFormatted: percentage.toFixed(1) + '%',
        status,
        statusIcon,
        transactionCount: spentByCategory[budget.category]?.transactions.length || 0,
        transactions: spentByCategory[budget.category]?.transactions || [],
        daysInMonth,
        currentDay,
        dailyBudget: dailyBudget.toFixed(2),
        dailyAverage: dailyAverage.toFixed(2),
        projectedEndOfMonth: projectedEndOfMonth.toFixed(2),
      };
    });

    return budgetsWithSpent;
  }

  static processGoals(goals: GoalsDataRaw): ProcessedGoal[] {
    const now = new Date();

    return goals.map(goal => {
      const target = parseFloat(goal.targetAmount);
      const current = parseFloat(goal.currentAmount);
      const remaining = target - current;
      const progress = target > 0 ? (current / target * 100) : 0;

      const deadline = new Date(goal.targetDate);
      const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const monthsRemaining = (daysRemaining / 30).toFixed(1);

      const monthlyRequired = parseFloat(monthsRemaining) > 0
        ? (remaining / parseFloat(monthsRemaining)).toFixed(2)
        : remaining.toFixed(2);

      let status: 'completed' | 'overdue' | 'on-track' | 'needs-attention' | 'critical';
      if (progress >= 100) {
        status = 'completed';
      } else if (daysRemaining < 0) {
        status = 'overdue';
      } else if (progress >= 75) {
        status = 'on-track';
      } else if (progress >= 50) {
        status = 'needs-attention';
      } else {
        status = 'critical';
      }

      return {
        ...goal,
        progress: progress.toFixed(2) + '%',
        remaining: remaining.toFixed(2),
        daysRemaining,
        monthsRemaining,
        monthlyRequired,
        status,
        isOverdue: daysRemaining < 0,
        isCompleted: progress >= 100,
      };
    });
  }

  static processInvestments(investments: InvestmentsDataRaw): ProcessedInvestment[] {
    return investments.map(inv => {
      const purchaseValue = parseFloat(inv.purchaseValue);
      const currentValue = parseFloat(inv.value);

      const gainLoss = currentValue - purchaseValue;
      const gainLossPercent = purchaseValue > 0 ? (gainLoss / purchaseValue * 100) : 0;

      return {
        ...inv,
        totalInvested: purchaseValue.toFixed(2),
        currentValue: currentValue.toFixed(2),
        gainLoss: gainLoss.toFixed(2),
        gainLossPercent: gainLossPercent.toFixed(2) + '%',
        performance: gainLoss >= 0 ? 'profit' : 'loss',
        performanceIcon: gainLoss >= 0 ? '📈' : '📉',
      };
    });
  }
}
