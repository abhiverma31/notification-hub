import 'reflect-metadata';

const mockUpdateOne = jest.fn().mockResolvedValue({});

jest.mock('../../../../src/shared-library/models/User', () => ({
  UserModel: { updateOne: mockUpdateOne },
  UserId: { build: jest.fn((orgId, email) => `${orgId}::${email}`) },
}));

import UserRepository from '../../../../src/shared-library/repositories/User';

const repo = new UserRepository();

beforeEach(() => jest.clearAllMocks());

describe('UserRepository.updateTelegramChatId', () => {
  it('calls updateOne with correct filter and chatId', async () => {
    await repo.updateTelegramChatId('org-123', '+919876543210', '111222333');

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'org-123::+919876543210@telegram', phone_number: '+919876543210' },
      expect.objectContaining({ $set: expect.objectContaining({ telegram_chat_id: '111222333' }) }),
    );
  });

  // Fix 2: NoSQL injection prevention — uses exact _id match, not regex
  it('uses exact _id match not regex to prevent NoSQL injection', async () => {
    await repo.updateTelegramChatId('.*', '+919876543210', 'attacker-chat-id');

    const callArgs = mockUpdateOne.mock.calls[0][0];
    // Must NOT use $regex
    expect(callArgs._id).not.toHaveProperty('$regex');
    // Must use exact string match via UserId.build
    expect(typeof callArgs._id).toBe('string');
    expect(callArgs._id).toBe('.*::+919876543210@telegram');
  });
});
