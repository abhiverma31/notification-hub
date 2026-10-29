import 'reflect-metadata';
import { TelegramController } from '../../../../src/server/controllers/Telegram';
import { TelegramWebhookService } from '../../../../src/server/services/TelegramWebhook';
import { OrganisationService } from '../../../../src/server/services/Organisation';
import { Request as ExRequest } from 'express';

const mockTelegramWebhookService = {
  handleWebhook: jest.fn(),
} as unknown as jest.Mocked<TelegramWebhookService>;

const makeController = (secretToken?: string) => {
  const mockOrganisationService = {
    getSettings: jest.fn().mockResolvedValue({
      telegram: secretToken ? [{ settings: { webhookSecretToken: secretToken } }] : [],
    }),
  } as unknown as jest.Mocked<OrganisationService>;
  return new TelegramController(mockTelegramWebhookService, mockOrganisationService);
};

const makeReq = (overrides: Partial<ExRequest> = {}) => ({
  body: { message: { chat: { id: 123 }, text: '/start' } },
  headers: {},
  socket: { remoteAddress: '127.0.0.1' },
  ...overrides,
} as unknown as ExRequest);

beforeEach(() => jest.clearAllMocks());

describe('TelegramController', () => {
  it('instantiates correctly', () => {
    expect(makeController()).toBeInstanceOf(TelegramController);
  });

  it('calls handleWebhook with organisationId and request body', async () => {
    const controller = makeController('my-secret');
    const req = makeReq({ headers: { 'x-telegram-bot-api-secret-token': 'my-secret' } });
    await controller.webhook('org-123', req);
    expect(mockTelegramWebhookService.handleWebhook).toHaveBeenCalledWith('org-123', req.body);
  });

  it('does not throw when handleWebhook resolves', async () => {
    const controller = makeController('my-secret');
    mockTelegramWebhookService.handleWebhook.mockResolvedValue(undefined);
    await expect(controller.webhook('org-456', makeReq({ headers: { 'x-telegram-bot-api-secret-token': 'my-secret' } }))).resolves.toBeUndefined();
  });

  // Fix 1: Webhook secret token validation
  it('rejects request with wrong secret token', async () => {
    const controller = makeController('correct-secret');
    const req = makeReq({ headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' } });
    await expect(controller.webhook('org-123', req)).rejects.toThrow();
    expect(mockTelegramWebhookService.handleWebhook).not.toHaveBeenCalled();
  });

  it('allows request with correct secret token', async () => {
    const controller = makeController('correct-secret');
    const req = makeReq({ headers: { 'x-telegram-bot-api-secret-token': 'correct-secret' } });
    await controller.webhook('org-123', req);
    expect(mockTelegramWebhookService.handleWebhook).toHaveBeenCalled();
  });

  it('rejects request when no secret is configured (fail closed)', async () => {
    const controller = makeController(); // no secret configured
    const req = makeReq({ headers: {} });
    await expect(controller.webhook('org-123', req)).rejects.toThrow();
    expect(mockTelegramWebhookService.handleWebhook).not.toHaveBeenCalled();
  });

  // Fix 3: Rate limiting
  it('returns 429 when rate limit is exceeded', async () => {
    const controller = makeController('rate-secret');
    controller.setStatus = jest.fn();
    const ip = `test-rate-limit-ip-${Date.now()}`; // unique IP to avoid interference
    const req = makeReq({ socket: { remoteAddress: ip } as any, headers: { 'x-telegram-bot-api-secret-token': 'rate-secret' } });

    // Send 30 requests (the limit)
    for (let i = 0; i < 30; i++) {
      await controller.webhook('org-123', req);
    }
    jest.clearAllMocks();
    controller.setStatus = jest.fn();

    // 31st should be rate limited
    await controller.webhook('org-123', req);
    expect(controller.setStatus).toHaveBeenCalledWith(429);
    expect(mockTelegramWebhookService.handleWebhook).not.toHaveBeenCalled();
  });
});
