import 'reflect-metadata';
import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';

jest.mock('twilio', () => ({
  __esModule: true,
  default: {
    validateRequest: jest.fn(),
  },
}));

jest.mock('../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn().mockReturnValue('decrypted-auth-token'),
}));

const mockGetProviderSettings = jest.fn();
jest.mock('../../../../src/consumer/services/Organisation', () => ({
  OrganisationService: jest.fn().mockImplementation(() => ({
    getProviderSettings: mockGetProviderSettings,
  })),
}));

import { container } from 'tsyringe';
jest.spyOn(container, 'resolve').mockReturnValue({
  getProviderSettings: mockGetProviderSettings,
});

import { twilioWebhookAuth } from '../../../../src/server/middlewares/TwilioWebhookAuth';

describe('twilioWebhookAuth', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (container.resolve as jest.Mock).mockReturnValue({
      getProviderSettings: mockGetProviderSettings,
    });
    mockReq = {
      query: { organisationId: 'org-123', transactionId: 'txn-456' },
      headers: { 'x-twilio-signature': 'valid-signature' },
      body: { MessageStatus: 'delivered' },
      protocol: 'https',
      get: jest.fn().mockReturnValue('api.easynotify.ai'),
      originalUrl: '/api/webhooks/twilio/whatsapp?organisationId=org-123&transactionId=txn-456',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should return 401 when organisationId query param is missing', async () => {
    mockReq.query = {};

    await twilioWebhookAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when X-Twilio-Signature header is missing', async () => {
    mockReq.headers = {};

    await twilioWebhookAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when organisation has no WhatsApp settings', async () => {
    mockGetProviderSettings.mockResolvedValueOnce(undefined);

    await twilioWebhookAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when signature validation fails', async () => {
    mockGetProviderSettings.mockResolvedValueOnce({ auth: { authToken: 'encrypted-token' } });
    (twilio.validateRequest as jest.Mock).mockReturnValueOnce(false);

    await twilioWebhookAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when signature validation succeeds', async () => {
    mockGetProviderSettings.mockResolvedValueOnce({ auth: { authToken: 'encrypted-token' } });
    (twilio.validateRequest as jest.Mock).mockReturnValueOnce(true);

    await twilioWebhookAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
