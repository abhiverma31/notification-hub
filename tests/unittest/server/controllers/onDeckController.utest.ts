import 'reflect-metadata';
import { OnDeckController } from '../../../../src/server/controllers/OnDeck';
import { OnDeckService } from '../../../../src/server/services/OnDeck';
import { OnDeckRepository } from '../../../../src/shared-library/repositories/OnDeck';
import { OrganisationInterface } from '../../../../src/shared-library/models/Organisation';
import { NHRequest, NHRequestUser } from '../../../../src/server/types/internal/NHRequest';
import UserRepository from '../../../../src/shared-library/repositories/User';

describe('OnDeckController', () => {
  let onDeckController: OnDeckController;
  let onDeckService: OnDeckService;

  const mockOutput = [
    {
      id: '1',
      title: 'Title',
      source: 'Source',
      content: 'Content',
      is_read: false,
      is_archived: false,
      source_creation_timestamp: Date.now(),
      recipient_email: 'joe@email.com',
      recipient_name: 'Joe',
    },
  ];

  beforeEach(() => {
    onDeckService = new OnDeckService({} as unknown as OnDeckRepository, {} as unknown as UserRepository);
    onDeckController = new OnDeckController(onDeckService);
    onDeckController.setStatus = jest.fn();
  });

  it('should handle fetching notifications with default query parameters successfully', async () => {
    onDeckService.getNotifications = jest.fn().mockResolvedValue(mockOutput);

    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const emailId = 'test@test.com';
    const response = await onDeckController.getNotifications(request as NHRequest);

    expect(onDeckService.getNotifications).toHaveBeenCalledWith(request.user!.organisation!._id, request.user?.user?.email, 0, 10, true);
    expect(response).toStrictEqual(mockOutput);
  });

  it('should handle fetching notifications with default query parameters and without recipient email id successfully', async () => {
    onDeckService.getNotifications = jest.fn().mockResolvedValue(mockOutput);

    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const response = await onDeckController.getNotifications(request as NHRequest);

    expect(onDeckService.getNotifications).toHaveBeenCalledWith(request.user!.organisation!._id, request.user?.user?.email, 0, 10, true);
    expect(response).toStrictEqual(mockOutput);
});

  it('should handle fetching notifications with specific query parameters successfully', async () => {
    onDeckService.getNotifications = jest.fn().mockResolvedValue(mockOutput);

    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const emailId = 'test@test.com';
    const page = 5;
    const itemsPerPage = 7;

    const response = await onDeckController.getNotifications(request as NHRequest, page, itemsPerPage, true);

    expect(onDeckService.getNotifications).toHaveBeenCalledWith(
      request.user!.organisation!._id,
      request.user?.user?.email,
      page,
      itemsPerPage,
      true
    );
    expect(response).toStrictEqual(mockOutput);
  });

  it('should handle marking notifications read successfully', async () => {
    onDeckService.updateNotification = jest.fn();

    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const id = '1';

    const response = await onDeckController.readNotification(request as NHRequest, id);

    expect(onDeckService.updateNotification).toHaveBeenCalledWith(request.user!.organisation!._id, id, true);
    expect(response).toBeUndefined();
  });

  it('should handle marking notifications unread successfully', async () => {
    onDeckService.updateNotification = jest.fn();

    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const id = '1';
    const response = await onDeckController.unreadNotification(request as NHRequest, id);

    expect(onDeckService.updateNotification).toHaveBeenCalledWith(request.user!.organisation!._id, id, false);
    expect(response).toBeUndefined();
  });

  it('should handle marking all notifications read successfully', async () => {
    onDeckService.readAllNotifications = jest.fn();

    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const emailId = 'test@test.com';
    const response = await onDeckController.readAllNotifications(request as NHRequest);

    expect(onDeckService.readAllNotifications).toHaveBeenCalledWith(request.user!.organisation!._id, request.user?.user?.email);
    expect(response).toBeUndefined();
  });

  it('should handle marking notifications unread successfully', async () => {
    onDeckService.archiveNotification = jest.fn();

    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const id = '1';
    const response = await onDeckController.archiveNotification(request as NHRequest, id);

    expect(onDeckService.archiveNotification).toHaveBeenCalledWith(request.user!.organisation!._id, id);
    expect(response).toBeUndefined();
  });

  it('should view all notifications successfully', async () => {
    onDeckService.viewAllNotifications = jest.fn();

    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const emailId = 'test@test.com';
    const response = await onDeckController.viewAllNotifications(request as NHRequest);

    expect(onDeckService.viewAllNotifications).toHaveBeenCalledWith(request.user!.organisation!._id, request.user?.user?.email);
    expect(response).toBeUndefined();
  });
});
