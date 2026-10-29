import 'reflect-metadata';
import UserRepository from '../../../../src/shared-library/repositories/User';
import { TelegramWebhookService } from '../../../../src/server/services/TelegramWebhook';

const userRepositoryMock = {
  upsert: jest.fn(),
} as unknown as jest.Mocked<UserRepository>;

const service = new TelegramWebhookService(userRepositoryMock);
const organisationId = 'org-123';

beforeEach(() => jest.clearAllMocks());

describe('TelegramWebhookService', () => {
  it('upserts user with phone number when /start +phone is sent', async () => {
    await service.handleWebhook(organisationId, {
      message: {
        chat: { id: 111222333 },
        text: '/start +919876543210',
        from: { first_name: 'John', last_name: 'Doe' },
      },
    });

    expect(userRepositoryMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: '+919876543210@telegram',
        phone_number: '+919876543210',
        telegram_chat_id: '111222333',
        name: { first: 'John', last: 'Doe' },
      }),
    );
  });

  it('upserts user with phone number when contact is shared', async () => {
    await service.handleWebhook(organisationId, {
      message: {
        chat: { id: 444555666 },
        contact: { phone_number: '+911234567890' },
        from: { first_name: 'Jane' },
      },
    });

    expect(userRepositoryMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: '+911234567890@telegram',
        phone_number: '+911234567890',
        telegram_chat_id: '444555666',
      }),
    );
  });

  it('upserts user with synthetic email when /start sent with no phone', async () => {
    await service.handleWebhook(organisationId, {
      message: {
        chat: { id: 777888999 },
        text: '/start',
        from: { first_name: 'Anonymous' },
      },
    });

    expect(userRepositoryMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'tg_777888999@telegram',
        telegram_chat_id: '777888999',
      }),
    );
    const call = (userRepositoryMock.upsert as jest.Mock).mock.calls[0][0];
    expect(call.phone_number).toBeUndefined();
  });

  it('sets external_user_id to chatId', async () => {
    await service.handleWebhook(organisationId, {
      message: {
        chat: { id: 123456789 },
        text: '/start',
        from: { first_name: 'Test' },
      },
    });

    expect(userRepositoryMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        external_user_id: '123456789',
        telegram_chat_id: '123456789',
      }),
    );
  });

  it('uses Telegram as default first name when from is missing', async () => {
    await service.handleWebhook(organisationId, {
      message: {
        chat: { id: 999 },
        text: '/start',
      },
    });

    expect(userRepositoryMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: { first: 'Telegram', last: undefined },
      }),
    );
  });

  it('does nothing when body has no message', async () => {
    await service.handleWebhook(organisationId, {});

    expect(userRepositoryMock.upsert).not.toHaveBeenCalled();
  });
});
