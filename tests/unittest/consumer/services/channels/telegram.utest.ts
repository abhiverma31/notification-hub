import 'reflect-metadata';
import axios from 'axios';
import { OrganisationService } from '../../../../../src/consumer/services/Organisation';
import { TelegramService } from '../../../../../src/consumer/services/channels/Telegram';
import { TelegramTemplateDetails } from '../../../../../src/shared-library/models/Template';
import { TelegramSettings } from '../../../../../src/shared-library/models/submodels/OrganisationSettings';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('axios');
jest.mock('../../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn((data: string) => data),
}));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const organisationServiceMock = {
  getProviderSettings: jest.fn(),
} as unknown as jest.Mocked<OrganisationService>;

const telegramService = new TelegramService(organisationServiceMock);

describe('TelegramService', () => {
  const organisationId = 'test-org-id';
  const template: TelegramTemplateDetails = { text: 'Hello from Telegram', parseMode: '' };
  const settings: TelegramSettings = { botToken: 'bot123', chatId: '-100123456' };

  beforeEach(() => jest.clearAllMocks());

  it('sends message via Telegram Bot API successfully', async () => {
    organisationServiceMock.getProviderSettings.mockResolvedValue(settings);
    mockedAxios.post.mockResolvedValue({ data: { ok: true } });

    await telegramService.send(template, organisationId);

    expect(organisationServiceMock.getProviderSettings).toHaveBeenCalledWith(organisationId, ChannelType.TELEGRAM);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
      { chat_id: settings.chatId, text: template.text },
    );
  });

  it('sends message with parseMode when specified', async () => {
    const templateWithMode: TelegramTemplateDetails = { text: '<b>Bold</b>', parseMode: 'HTML' };
    organisationServiceMock.getProviderSettings.mockResolvedValue(settings);
    mockedAxios.post.mockResolvedValue({ data: { ok: true } });

    await telegramService.send(templateWithMode, organisationId);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });

  it('throws BadRequest when Telegram settings are not configured', async () => {
    organisationServiceMock.getProviderSettings.mockResolvedValue(null as any);

    await expect(telegramService.send(template, organisationId)).rejects.toThrow(
      'Telegram settings are not provided!',
    );
  });

  it('throws Error when Telegram Bot API call fails', async () => {
    organisationServiceMock.getProviderSettings.mockResolvedValue(settings);
    mockedAxios.post.mockRejectedValue(new Error('Network Error'));

    await expect(telegramService.send(template, organisationId)).rejects.toThrow(
      'Error sending message to Telegram',
    );
  });
});
