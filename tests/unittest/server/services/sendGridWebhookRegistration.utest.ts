import 'reflect-metadata';
import axios from 'axios';
import { SendGridWebhookRegistrationService } from '../../../../src/server/services/SendGridWebhookRegistration';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const API_KEY = 'SG.test-api-key';
const SERVER_URL = 'https://api.easynotify.ai';
const WEBHOOK_URL = `${SERVER_URL}/api/webhooks/sendgrid/events`;

function buildWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: 'webhook-123',
    enabled: true,
    url: WEBHOOK_URL,
    delivered: true,
    bounce: true,
    deferred: true,
    dropped: true,
    processed: true,
    open: true,
    click: true,
    spam_report: true,
    friendly_name: 'EasyNotify Event Webhook',
    created_date: '2024-01-01T00:00:00Z',
    updated_date: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('SendGridWebhookRegistrationService', () => {
  let service: SendGridWebhookRegistrationService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new SendGridWebhookRegistrationService();
    process.env = { ...originalEnv, SERVER_URL };
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  it('should skip registration when SERVER_URL is not set', async () => {
    delete process.env.SERVER_URL;

    const result = await service.register(API_KEY);

    expect(result).toEqual({ status: 'skipped', reason: 'SERVER_URL not configured' });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should create webhook when none exists', async () => {
    mockedAxios.get.mockResolvedValue({ data: { max_allowed: 5, webhooks: [] } });
    mockedAxios.post.mockResolvedValue({ data: { id: 'new-webhook-id' } });

    const result = await service.register(API_KEY);

    expect(result).toEqual({ status: 'created', webhookId: 'new-webhook-id' });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/user/webhooks/event/settings',
      expect.objectContaining({ enabled: true, url: WEBHOOK_URL }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }) }),
    );
  });

  it('should return already-configured when webhook exists with correct settings', async () => {
    mockedAxios.get.mockResolvedValue({ data: { max_allowed: 5, webhooks: [buildWebhook()] } });

    const result = await service.register(API_KEY);

    expect(result).toEqual({ status: 'already-configured', webhookId: 'webhook-123' });
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it('should update webhook when URL matches but events are misconfigured', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { max_allowed: 5, webhooks: [buildWebhook({ open: false })] },
    });
    mockedAxios.patch.mockResolvedValue({ data: {} });

    const result = await service.register(API_KEY);

    expect(result).toEqual({ status: 'updated', webhookId: 'webhook-123' });
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/user/webhooks/event/settings/webhook-123',
      expect.objectContaining({ open: true, enabled: true }),
      expect.any(Object),
    );
  });

  it('should handle 403 gracefully as insufficient permissions', async () => {
    const error = new Error('Forbidden') as Error & { response?: { status: number } };
    Object.assign(error, { response: { status: 403 }, isAxiosError: true });
    Object.setPrototypeOf(error, axios.AxiosError.prototype);
    mockedAxios.get.mockRejectedValue(error);

    const result = await service.register(API_KEY);

    expect(result).toEqual({ status: 'insufficient-permissions' });
  });

  it('should handle network errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network Error'));

    const result = await service.register(API_KEY);

    expect(result).toEqual({ status: 'error', reason: 'Network Error' });
  });

  it('should retry on ECONNRESET and succeed', async () => {
    const connResetError = new Error('socket hang up') as Error & { code?: string; response?: unknown };
    Object.assign(connResetError, { code: 'ECONNRESET', isAxiosError: true });
    Object.setPrototypeOf(connResetError, axios.AxiosError.prototype);

    mockedAxios.get
      .mockRejectedValueOnce(connResetError)
      .mockResolvedValueOnce({ data: { max_allowed: 5, webhooks: [] } });
    mockedAxios.post.mockResolvedValue({ data: { id: 'retry-webhook-id' } });

    const resultPromise = service.register(API_KEY);
    await jest.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result).toEqual({ status: 'created', webhookId: 'retry-webhook-id' });
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('should return error after exhausting retries on ECONNRESET', async () => {
    const connResetError = new Error('socket hang up') as Error & { code?: string; response?: unknown };
    Object.assign(connResetError, { code: 'ECONNRESET', isAxiosError: true });
    Object.setPrototypeOf(connResetError, axios.AxiosError.prototype);

    mockedAxios.get.mockRejectedValue(connResetError);

    const resultPromise = service.register(API_KEY);
    await jest.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(result.status).toBe('error');
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('should handle non-Error thrown values gracefully', async () => {
    mockedAxios.get.mockRejectedValue('string error');

    const result = await service.register(API_KEY);

    expect(result).toEqual({ status: 'error', reason: 'Unknown error' });
  });

  it('should not match webhooks with different URLs', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { max_allowed: 5, webhooks: [buildWebhook({ url: 'https://other.com/webhook' })] },
    });
    mockedAxios.post.mockResolvedValue({ data: { id: 'new-id' } });

    const result = await service.register(API_KEY);

    expect(result).toEqual({ status: 'created', webhookId: 'new-id' });
  });

  describe('disable', () => {
    it('should patch webhook with enabled: false', async () => {
      mockedAxios.patch.mockResolvedValue({ data: {} });

      await service.disable(API_KEY, 'webhook-123');

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/user/webhooks/event/settings/webhook-123',
        { enabled: false },
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }) }),
      );
    });

    it('should not throw when disable fails', async () => {
      mockedAxios.patch.mockRejectedValue(new Error('Network Error'));

      await expect(service.disable(API_KEY, 'webhook-123')).resolves.toBeUndefined();
    });
  });

  describe('deleteWebhook', () => {
    it('should call DELETE on the webhook endpoint', async () => {
      mockedAxios.delete.mockResolvedValue({ data: {} });

      await service.deleteWebhook(API_KEY, 'webhook-456');

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/user/webhooks/event/settings/webhook-456',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }) }),
      );
    });

    it('should not throw when delete fails', async () => {
      mockedAxios.delete.mockRejectedValue(new Error('Forbidden'));

      await expect(service.deleteWebhook(API_KEY, 'webhook-456')).resolves.toBeUndefined();
    });
  });
});
