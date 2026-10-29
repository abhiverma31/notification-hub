import 'reflect-metadata';
import { OnDeckRepository } from '../../../../src/shared-library/repositories/OnDeck';
import UserRepository from '../../../../src/shared-library/repositories/User';
import { OnDeckService } from '../../../../src/server/services/OnDeck';
import { OnDeckViewAdapter } from '../../../../src/shared-library/models/adapters/OnDeckViewAdapter';

jest.mock('../../../../src/shared-library/models/adapters/OnDeckViewAdapter');

describe('OnDeckService', () => {
  let onDeckRepository: OnDeckRepository;
  let onDeckService: OnDeckService;
  let userRepository: UserRepository;

  beforeEach(() => {
    onDeckRepository = new OnDeckRepository();
    userRepository = new UserRepository();
    onDeckService = new OnDeckService(onDeckRepository, userRepository);
  });

  it('should be able to get notifications', async () => {
    const repoOutput = [
      {
        id: '1',
        organisation_id: '1234',
        title: 'Title',
        source: 'Source',
        content: 'Content',
        is_read: false,
        is_archived: false,
        is_viewed: false,
        source_creation_timestamp: Date.now(),
        recipient: {
          email: 'joe@email.com',
          name: 'Joe',
        },
      },
    ];

    const output = [
      {
        id: '1',
        title: 'Title',
        source: 'Source',
        content: 'Content',
        is_read: false,
        is_archived: false,
        is_viewed: false,
        source_creation_timestamp: Date.now(),
        recipient_email: 'joe@email.com',
        recipient_name: 'Joe',
      },
    ];

    onDeckRepository.get = jest.fn().mockResolvedValue(repoOutput);
    const mockAdapter = jest.fn().mockReturnValue(output);
    OnDeckViewAdapter.adaptToOnDeckViews = mockAdapter;

    const organizationId = '1234';
    const emailId = 'test@test.com';
    const response = await onDeckService.getNotifications(organizationId, emailId, 0, 10, true);

    expect(onDeckRepository.get).toHaveBeenCalledWith(organizationId, 0, 10, emailId, true);
    expect(mockAdapter).toHaveBeenCalledWith(repoOutput);
    expect(response).toStrictEqual(output);
  });

  it('should return undefined when repository throws an error', async () => {
    onDeckRepository.get = jest.fn().mockRejectedValue(new Error('DB failure'));

    const response = await onDeckService.getNotifications('1234', 'test@test.com', 0, 10, true);

    expect(response).toBeUndefined();
  });

  it('should be able to update notifications', async () => {
    onDeckRepository.updateReadStatus = jest.fn();

    const organizationId = '1234';
    const id = '2';
    const markRead = true;

    const response = await onDeckService.updateNotification(organizationId, id, markRead);

    expect(onDeckRepository.updateReadStatus).toHaveBeenCalledWith(organizationId, id, markRead);
    expect(response).toBeUndefined();
  });

  it('should be able to update all notifications', async () => {
    onDeckRepository.readAllUnread = jest.fn();

    const organizationId = '1234';
    const email = 'test@test.com';

    const response = await onDeckService.readAllNotifications(organizationId, email);

    expect(onDeckRepository.readAllUnread).toHaveBeenCalledWith(organizationId, email);
    expect(response).toBeUndefined();
  });

  it('should be able to archive notifications', async () => {
    onDeckRepository.archive = jest.fn();

    const organizationId = '1234';
    const id = '4';

    const response = await onDeckService.archiveNotification(organizationId, id);

    expect(onDeckRepository.archive).toHaveBeenCalledWith(organizationId, id);
    expect(response).toBeUndefined();
  });

  it('should view all notifications', async () => {
    onDeckRepository.viewAllNotifications = jest.fn();

    const organizationId = '1234';
    const email = 'test@test.com';

    const response = await onDeckService.viewAllNotifications(organizationId, email);

    expect(onDeckRepository.viewAllNotifications).toHaveBeenCalledWith(organizationId, email);
    expect(response).toBeUndefined();
  });
});
