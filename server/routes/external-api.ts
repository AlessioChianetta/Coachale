import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireRole, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage';
import { ExternalLeadApiClient } from '../services/external-api-client';
import { LeadImportService } from '../services/lead-import-service';
import { pollingScheduler } from '../services/lead-polling-scheduler';
import { insertExternalApiConfigSchema, updateExternalApiConfigSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

router.get('/configs', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const configs = await storage.getAllExternalApiConfigs(consultantId);

    const configsWithMaskedKeys = configs.map(config => ({
      ...config,
      apiKey: `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}`,
    }));

    res.json({
      success: true,
      data: configsWithMaskedKeys,
    });
  } catch (error: any) {
    console.error('Error fetching external API configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configurations',
    });
  }
});

router.post('/configs', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const validatedData = insertExternalApiConfigSchema.parse({
      ...req.body,
      consultantId,
    });

    const config = await storage.createExternalApiConfig(validatedData);

    const maskedConfig = {
      ...config,
      apiKey: `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}`,
    };

    res.status(201).json({
      success: true,
      data: maskedConfig,
      message: 'Configuration created successfully',
    });
  } catch (error: any) {
    console.error('Error creating external API config:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    if (error.message?.includes('duplicate') || error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A configuration with this name already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create configuration',
    });
  }
});

router.patch('/configs/:id', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const configId = req.params.id;

    const validatedData = updateExternalApiConfigSchema.parse(req.body);

    const existingConfig = await storage.getExternalApiConfig(consultantId, configId);
    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found',
      });
    }

    const config = await storage.updateExternalApiConfig(configId, consultantId, validatedData);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found',
      });
    }

    const maskedConfig = {
      ...config,
      apiKey: `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}`,
    };

    res.json({
      success: true,
      data: maskedConfig,
      message: 'Configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating external API config:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update configuration',
    });
  }
});

router.delete('/configs/:id', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const configId = req.params.id;

    const existingConfig = await storage.getExternalApiConfig(consultantId, configId);
    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found',
      });
    }

    const success = await storage.deleteExternalApiConfig(configId, consultantId);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete configuration',
      });
    }

    res.json({
      success: true,
      message: 'Configuration deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting external API config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete configuration',
    });
  }
});

router.post('/configs/:id/test', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const configId = req.params.id;
    const consultantId = req.user!.id;

    const config = await storage.getExternalApiConfig(consultantId, configId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found',
      });
    }

    const client = new ExternalLeadApiClient(config.baseUrl, config.apiKey);
    
    // Test base connection
    const testResult = await client.testConnection();
    
    if (!testResult.success) {
      return res.json({
        success: false,
        error: testResult.error || 'Connection failed',
      });
    }

    // Fetch lead count con filtri configurati
    const filters = {
      type: config.leadType,
      limit: 1,
      offset: 0,
      days: config.daysFilter || undefined,
      source: config.sourceFilter || undefined,
      campaign: config.campaignFilter || undefined,
    };
    
    console.log('🔍 [TEST CONNECTION] Testing with filters:', JSON.stringify(filters, null, 2));
    
    const leadsResult = await client.fetchLeads(filters);
    
    console.log('📊 [TEST CONNECTION] API Response:', {
      success: leadsResult.success,
      total: leadsResult.total,
      dataLength: leadsResult.data?.length,
      error: leadsResult.error
    });

    const totalLeads = leadsResult.total || 0;

    res.json({
      success: true,
      message: 'Connection successful',
      totalLeads: totalLeads,
      filters: {
        type: config.leadType,
        source: config.sourceFilter,
        campaign: config.campaignFilter,
        days: config.daysFilter,
      },
    });
  } catch (error: any) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test connection',
    });
  }
});

router.post('/configs/:id/import', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const configId = req.params.id;

    const config = await storage.getExternalApiConfig(consultantId, configId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found',
      });
    }

    if (!config.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Configuration is not active',
      });
    }

    const importService = new LeadImportService();
    const result = await importService.importLeadsFromExternal(config, 'manual');

    const statusCode = result.errored > 0 && result.imported === 0 && result.updated === 0 ? 500 : 200;

    res.status(statusCode).json({
      success: result.imported > 0 || result.updated > 0,
      data: result,
      message: `Import completed: ${result.imported} imported, ${result.updated} updated, ${result.errored} errors`,
    });
  } catch (error: any) {
    console.error('Error importing leads:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Import failed',
    });
  }
});

router.post('/configs/:id/start-polling', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const configId = req.params.id;

    const config = await storage.getExternalApiConfig(consultantId, configId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found',
      });
    }

    const updatedConfig = await storage.updateExternalApiConfig(configId, consultantId, {
      pollingEnabled: true,
    });

    if (!updatedConfig) {
      return res.status(500).json({
        success: false,
        error: 'Failed to enable polling',
      });
    }

    try {
      await pollingScheduler.startPolling(configId);
      console.log(`✅ Polling scheduler started for config ${configId}`);
    } catch (schedulerError: any) {
      console.error(`⚠️ Warning: Failed to start polling scheduler for config ${configId}:`, schedulerError.message);
    }

    res.json({
      success: true,
      message: 'Polling enabled successfully',
      data: {
        pollingEnabled: true,
        pollingIntervalMinutes: updatedConfig.pollingIntervalMinutes,
      },
    });
  } catch (error: any) {
    console.error('Error enabling polling:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable polling',
    });
  }
});

router.post('/configs/:id/stop-polling', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const configId = req.params.id;

    const config = await storage.getExternalApiConfig(consultantId, configId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found',
      });
    }

    const updatedConfig = await storage.updateExternalApiConfig(configId, consultantId, {
      pollingEnabled: false,
    });

    if (!updatedConfig) {
      return res.status(500).json({
        success: false,
        error: 'Failed to disable polling',
      });
    }

    try {
      await pollingScheduler.stopPolling(configId);
      console.log(`🛑 Polling scheduler stopped for config ${configId}`);
    } catch (schedulerError: any) {
      console.error(`⚠️ Warning: Failed to stop polling scheduler for config ${configId}:`, schedulerError.message);
    }

    res.json({
      success: true,
      message: 'Polling disabled successfully',
      data: {
        pollingEnabled: false,
      },
    });
  } catch (error: any) {
    console.error('Error disabling polling:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable polling',
    });
  }
});

router.get('/configs/:id/logs', authenticateToken, requireRole('consultant'), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const configId = req.params.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const config = await storage.getExternalApiConfig(consultantId, configId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found',
      });
    }

    const logs = await storage.getExternalLeadImportLogs(configId, limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('Error fetching import logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch import logs',
    });
  }
});

export default router;
