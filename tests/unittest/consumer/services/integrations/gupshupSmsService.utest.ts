import 'reflect-metadata';
import { GupshupSmsService } from '../../../../../src/consumer/services/integrations/GupshupSmsService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GupshupSmsService', () => {
  const service = new GupshupSmsService();
  const settings = { userid: 'testuser', password: 'testpass', mask: 'SENDER' };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GUPSHUP_SMS_ENABLED;
  });

  it('should skip send when GUPSHUP_SMS_ENABLED is false', async () => {
    process.env.GUPSHUP_SMS_ENABLED = 'false';

    await service.send('Hello', '+919876543210', settings);

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should call Gupshup API with POST and correct params', async () => {
    process.env.GUPSHUP_SMS_ENABLED = 'true';
    mockedAxios.post.mockResolvedValue({ data: 'success|919876543210|msgid123' });

    await service.send('Hello World', '+919876543210', settings);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://enterprise.smsgupshup.com/GatewayAPI/rest',
      expect.any(String),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const body = new URLSearchParams(mockedAxios.post.mock.calls[0][1] as string);
    expect(body.get('method')).toBe('SendMessage');
    expect(body.get('send_to')).toBe('+919876543210');
    expect(body.get('msg')).toBe('Hello World');
    expect(body.get('userid')).toBe('testuser');
    expect(body.get('password')).toBe('testpass');
    expect(body.get('send_from')).toBe('SENDER');
    expect(body.get('auth_scheme')).toBe('plain');
    expect(body.get('v')).toBe('1.1');
    expect(body.get('format')).toBe('text');
    expect(body.get('msg_type')).toBe('text');
  });

  it('should include DLT params when provided', async () => {
    process.env.GUPSHUP_SMS_ENABLED = 'true';
    mockedAxios.post.mockResolvedValue({ data: 'success|919876543210|msgid123' });
    const settingsWithDlt = { ...settings, principalEntityId: 'entity123', dltTemplateId: 'tmpl456' };

    await service.send('OTP is 1234', '+919876543210', settingsWithDlt);

    const body = new URLSearchParams(mockedAxios.post.mock.calls[0][1] as string);
    expect(body.get('principalEntityId')).toBe('entity123');
    expect(body.get('dltTemplateId')).toBe('tmpl456');
  });

  it('should not include DLT params when not provided', async () => {
    process.env.GUPSHUP_SMS_ENABLED = 'true';
    mockedAxios.post.mockResolvedValue({ data: 'success|919876543210|msgid123' });

    await service.send('Hello', '+919876543210', settings);

    const body = new URLSearchParams(mockedAxios.post.mock.calls[0][1] as string);
    expect(body.has('principalEntityId')).toBe(false);
    expect(body.has('dltTemplateId')).toBe(false);
  });

  it('should throw when Gupshup returns error response', async () => {
    process.env.GUPSHUP_SMS_ENABLED = 'true';
    mockedAxios.post.mockResolvedValue({ data: 'error|700|Invalid userid or password' });

    await expect(service.send('Hello', '+919876543210', settings)).rejects.toThrow(
      'Gupshup SMS failed: error|700|Invalid userid or password',
    );
  });
});
