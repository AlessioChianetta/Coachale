import type {
  DashboardDataRaw,
  CategoryBudgetsDataRaw,
  TransactionsDataRaw,
  AccountArchitectureDataRaw,
  BudgetSettingsDataRaw,
  InvestmentsDataRaw,
  GoalsDataRaw,
} from "./percorso-capitale-types";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const globalCache = new Map<string, CacheEntry<any>>();

const clientInstances = new Map<string, PercorsoCapitaleClient>();

export class PercorsoCapitaleClient {
  private apiKey: string;
  private baseUrl: string;
  private userEmail: string;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private requestCount: number = 0;

  private readonly TTL_CONFIG = {
    dashboard: 5 * 60 * 1000,
    categoryBudgets: 60 * 60 * 1000,
    transactions: 60 * 60 * 1000,
    accountArchitecture: 24 * 60 * 60 * 1000,
    budgetSettings: 24 * 60 * 60 * 1000,
    investments: 4 * 60 * 60 * 1000,
    goals: 6 * 60 * 60 * 1000,
  };

  private constructor(apiKey: string, baseUrl: string, userEmail: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.userEmail = userEmail;
    console.log(`[PercorsoCapitale] Client initialized for user: ${this.maskEmail(userEmail)}`);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const maskedLocal = local.substring(0, 2) + '***';
    return `${maskedLocal}@${domain}`;
  }

  static getInstance(apiKey: string, baseUrl: string, userEmail: string): PercorsoCapitaleClient {
    const cacheKey = `${apiKey}:${baseUrl}:${userEmail}`;
    
    if (!clientInstances.has(cacheKey)) {
      clientInstances.set(cacheKey, new PercorsoCapitaleClient(apiKey, baseUrl, userEmail));
    }
    
    return clientInstances.get(cacheKey)!;
  }

  private async fetchWithCache<T>(
    endpoint: string,
    cacheKey: keyof typeof this.TTL_CONFIG,
    cacheKeySuffix: string = ''
  ): Promise<T | null> {
    this.requestCount++;
    const requestId = `req-${this.requestCount}`;
    const fullCacheKey = `${this.userEmail}:${cacheKey}${cacheKeySuffix}`;
    const cached = globalCache.get(fullCacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.cacheHits++;
      const ttlRemaining = Math.round((cached.expiresAt - Date.now()) / 1000);
      console.log(`[PercorsoCapitale] ${requestId} Cache HIT for ${cacheKey} (user: ${this.maskEmail(this.userEmail)}, TTL: ${ttlRemaining}s, stats: ${this.cacheHits}/${this.requestCount} hits)`);
      return cached.data as T;
    }

    this.cacheMisses++;
    
    try {
      const startTime = Date.now();
      console.log(`[PercorsoCapitale] ${requestId} Cache MISS for ${cacheKey} (user: ${this.maskEmail(this.userEmail)}), fetching from API... (stats: ${this.cacheHits}/${this.requestCount} hits)`);
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'X-User-Email': this.userEmail,
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        console.error(`[PercorsoCapitale] ${requestId} API error for ${cacheKey}: ${response.status} ${response.statusText} (${responseTime}ms)`);
        return null;
      }

      const data = await response.json() as T;

      globalCache.set(fullCacheKey, {
        data,
        expiresAt: Date.now() + this.TTL_CONFIG[cacheKey],
      });

      const ttlSeconds = this.TTL_CONFIG[cacheKey] / 1000;
      console.log(`[PercorsoCapitale] ${requestId} Cached ${cacheKey} for ${ttlSeconds}s (${responseTime}ms response time)`);
      return data;
    } catch (error) {
      console.error(`[PercorsoCapitale] ${requestId} Fetch error for ${cacheKey}:`, error);
      return null;
    }
  }

  async getDashboard(): Promise<DashboardDataRaw | null> {
    return this.fetchWithCache<DashboardDataRaw>('/api/public/dashboard', 'dashboard');
  }

  async getCategoryBudgets(): Promise<CategoryBudgetsDataRaw | null> {
    return this.fetchWithCache<CategoryBudgetsDataRaw>('/api/public/category-budgets', 'categoryBudgets');
  }

  async getTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    account?: string;
  }): Promise<TransactionsDataRaw | null> {
    let endpoint = '/api/public/transactions';
    let cacheKeySuffix = '';
    
    const params = new URLSearchParams();
    params.append('limit', '999999');
    
    if (filters) {
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.category) params.append('category', filters.category);
      if (filters.account) params.append('account', filters.account);
    }
    
    const queryString = params.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
      cacheKeySuffix = `:${queryString}`;
    }

    return this.fetchWithCache<TransactionsDataRaw>(endpoint, 'transactions', cacheKeySuffix);
  }

  async getAccountArchitecture(): Promise<AccountArchitectureDataRaw | null> {
    return this.fetchWithCache<AccountArchitectureDataRaw>('/api/public/account-architecture', 'accountArchitecture');
  }

  async getBudgetSettings(): Promise<BudgetSettingsDataRaw | null> {
    return this.fetchWithCache<BudgetSettingsDataRaw>('/api/public/budget-settings', 'budgetSettings');
  }

  async getInvestments(): Promise<InvestmentsDataRaw | null> {
    return this.fetchWithCache<InvestmentsDataRaw>('/api/public/investments', 'investments');
  }

  async getGoals(): Promise<GoalsDataRaw | null> {
    return this.fetchWithCache<GoalsDataRaw>('/api/public/goals', 'goals');
  }



  async getCostAnalysisDashboard(): Promise<any | null> {
    return this.fetchWithCache<any>('/api/public/cost-analysis/dashboard', 'dashboard');
  }


  clearCache(cacheKey?: keyof typeof this.TTL_CONFIG): void {
    if (cacheKey) {
      const prefix = `${this.userEmail}:${cacheKey}`;
      const keysToDelete = Array.from(globalCache.keys()).filter(key => key.startsWith(prefix));
      keysToDelete.forEach(key => globalCache.delete(key));
      console.log(`[PercorsoCapitale] Cleared ${keysToDelete.length} cache entries for ${cacheKey}`);
    } else {
      const userKeys = Array.from(globalCache.keys()).filter(key => key.startsWith(`${this.userEmail}:`));
      userKeys.forEach(key => globalCache.delete(key));
      console.log(`[PercorsoCapitale] Cleared all cache for user ${this.userEmail}`);
    }
  }

  getCacheStats(): { total: number; hits: number; misses: number; hitRate: number; size: number } {
    const userKeys = Array.from(globalCache.keys()).filter(key => key.startsWith(`${this.userEmail}:`));
    const hitRate = this.requestCount > 0 ? Math.round((this.cacheHits / this.requestCount) * 100) : 0;
    
    return {
      total: this.requestCount,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
      size: userKeys.length,
    };
  }

  logCacheStats(): void {
    const stats = this.getCacheStats();
    console.log(`[PercorsoCapitale] Cache Stats for ${this.maskEmail(this.userEmail)}: ${stats.hits}/${stats.total} hits (${stats.hitRate}%), ${stats.size} cached entries`);
  }
}
