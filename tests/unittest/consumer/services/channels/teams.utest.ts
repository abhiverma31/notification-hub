import 'reflect-metadata';
import axios from 'axios';
import { OrganisationService } from '../../../../../src/consumer/services/Organisation';
import { TeamsService } from '../../../../../src/consumer/services/channels/Teams';
import { TeamsTemplateDetails } from '../../../../../src/shared-library/models/Template';
import { TeamsSettings } from '../../../../../src/shared-library/models/submodels/OrganisationSettings';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const organisationServiceMock = {
  getProviderSettings: jest.fn(),
} as unknown as jest.Mocked<OrganisationService>;

const teamsService = new TeamsService(organisationServiceMock);

describe('TeamsService', () => {
  const organisationId = 'test-organisation-id';
  const template: TeamsTemplateDetails = {
    title: 'Test Teams message',
    content: '<b>Test Teams message</b>',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send a message to Teams through webhook successfully', async () => {
    const teamsSettings: TeamsSettings = {
      webhook: 'https://outlook.office.com/webhook/test/webhook',
    };
    organisationServiceMock.getProviderSettings.mockResolvedValue(teamsSettings);
    mockedAxios.post.mockResolvedValue({ data: 'ok' });
    await teamsService.send(template, organisationId);
    expect(organisationServiceMock.getProviderSettings).toHaveBeenCalledWith(organisationId, ChannelType.TEAMS);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      teamsSettings.webhook,
      expect.objectContaining({ content: template.content, title: template.title }),
    );
  });

  it('should throw an error if Teams settings are not provided', async () => {
    organisationServiceMock.getProviderSettings.mockResolvedValue(undefined);
    await expect(teamsService.send(template, organisationId)).rejects.toThrow('Teams settings are not provided!');
  });

  it('should throw an error if webhook url is not provided', async () => {
    const teamsSettings: TeamsSettings = {} as TeamsSettings;
    organisationServiceMock.getProviderSettings.mockResolvedValue(teamsSettings);
    await expect(teamsService.send(template, organisationId)).rejects.toThrow('Teams webhook url is not provided!');
  });

  it('should throw an error if message sending to Teams fails', async () => {
    const teamsSettings: TeamsSettings = { webhook: 'https://outlook.office.com/webhook/test/webhook' };
    organisationServiceMock.getProviderSettings.mockResolvedValue(teamsSettings);
    mockedAxios.post.mockRejectedValue(new Error('Network Error'));
    await expect(teamsService.send(template, organisationId)).rejects.toThrow('Error sending message to Teams');
  });
});
