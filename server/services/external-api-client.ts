import axios, { AxiosInstance } from 'axios';

export interface FetchLeadsOptions {
  type?: 'crm' | 'marketing' | 'both';
  limit?: number;
  offset?: number;
  days?: string;
  source?: string;
  campaign?: string;
}

export interface FetchLeadsResponse {
  success: boolean;
  data: any[];
  total: number;
  error?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  error?: string;
}

export class ExternalLeadApiClient {
  private client: AxiosInstance;

  constructor(private baseUrl: string, private apiKey: string) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection(): Promise<TestConnectionResponse> {
    try {
      const response = await this.client.get('/api/external/leads', {
        params: {
          limit: 1,
        },
      });

      if (response.status === 200 && response.data.success) {
        return { success: true };
      }

      return {
        success: false,
        error: 'API responded with unexpected format',
      };
    } catch (error: any) {
      console.error('External API test connection failed:', error);
      
      if (error.response) {
        const status = error.response.status;
        if (status === 401 || status === 403) {
          return {
            success: false,
            error: 'Authentication failed - invalid API key',
          };
        }
        return {
          success: false,
          error: `API error: ${error.response.statusText || error.message}`,
        };
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: 'Cannot connect to API - check base URL',
        };
      }

      return {
        success: false,
        error: error.message || 'Connection test failed',
      };
    }
  }

  async fetchLeads(options: FetchLeadsOptions = {}): Promise<FetchLeadsResponse> {
    try {
      const params: any = {};

      if (options.type) params.type = options.type;
      if (options.limit) params.limit = options.limit;
      if (options.offset) params.offset = options.offset;
      if (options.days) params.days = options.days;
      if (options.source) params.source = options.source;
      if (options.campaign) params.campaign = options.campaign;

      const response = await this.client.get('/api/external/leads', { params });

      if (response.status === 200 && response.data.success) {
        return {
          success: true,
          data: response.data.data || [],
          total: response.data.pagination?.total || response.data.data?.length || 0,
        };
      }

      return {
        success: false,
        data: [],
        total: 0,
        error: 'API responded with unexpected format',
      };
    } catch (error: any) {
      console.error('External API fetch leads failed:', error);

      if (error.response) {
        const status = error.response.status;
        if (status === 401 || status === 403) {
          return {
            success: false,
            data: [],
            total: 0,
            error: 'Authentication failed - invalid API key',
          };
        }
        return {
          success: false,
          data: [],
          total: 0,
          error: `API error: ${error.response.statusText || error.message}`,
        };
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return {
          success: false,
          data: [],
          total: 0,
          error: 'Cannot connect to API - check base URL',
        };
      }

      return {
        success: false,
        data: [],
        total: 0,
        error: error.message || 'Failed to fetch leads',
      };
    }
  }
}
