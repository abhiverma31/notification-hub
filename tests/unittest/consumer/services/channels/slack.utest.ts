import 'reflect-metadata';
import axios from 'axios';
import { OrganisationService } from '../../../../../src/consumer/services/Organisation';
import { SlackService } from '../../../../../src/consumer/services/channels/Slack';
import { SlackTemplateDetails } from '../../../../../src/shared-library/models/Template';
import { SlackSettings } from '../../../../../src/shared-library/models/submodels/OrganisationSettings';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';
import { WebClient } from '@slack/web-api';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.mock('@slack/web-api');

const organisationServiceMock = {
  getProviderSettings: jest.fn(),
} as unknown as jest.Mocked<OrganisationService>;

const slackService = new SlackService(organisationServiceMock);

describe('SlackService', () => {
  const organisationId = 'test-organisation-id';
  const template: SlackTemplateDetails = {
    text: 'Test message',
    channel: 'random',
    icon_emoji: ':shallow_pan_of_food:',
    icon_url: 'https://res.cloudinary.com/dqhzj9nig/image/upload/v1715930922/cld-sample-4.jpg',
    username: 'zomato',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send a message to Slack through webhook successfully', async () => {
    const slackSettings: SlackSettings = {
      webhook: 'https://hooks.slack.com/services/test/webhook',
    };

    const template: SlackTemplateDetails = {
      text: 'Test message',
    };

    organisationServiceMock.getProviderSettings.mockResolvedValue(slackSettings);
    mockedAxios.post.mockResolvedValue({ data: 'ok' });

    await slackService.send(template, organisationId);

    expect(organisationServiceMock.getProviderSettings).toHaveBeenCalledWith(organisationId, ChannelType.SLACK);
    expect(mockedAxios.post).toHaveBeenCalledWith(slackSettings.webhook, template);
  });

  it('should send a message to Slack through oAuth tokensuccessfully', async () => {
    const slackSettings: SlackSettings = {
      oAuthToken: 'slack-oauth-token-placeholder',
      slack_channel: 'random',
      bot_name: 'zomato',
      icon_url: 'https://res.cloudinary.com/dqhzj9nig/image/upload/v1715930922/cld-sample-4.jpg',
      icon_emoji: ':shallow_pan_of_food:',
    };

    organisationServiceMock.getProviderSettings.mockResolvedValue(slackSettings);

    const postMessageMock = jest.fn().mockResolvedValue({ ok: true });
    const setPresenceMock = jest.fn().mockResolvedValue({});

    (WebClient as unknown as jest.Mock).mockImplementation(() => ({
      chat: { postMessage: postMessageMock },
      users: { setPresence: setPresenceMock },
    }));

    await slackService.send(template, organisationId);

    expect(organisationServiceMock.getProviderSettings).toHaveBeenCalledWith(organisationId, ChannelType.SLACK);
    expect(postMessageMock).toHaveBeenCalledWith({
      text: template.text,
      channel: slackSettings.slack_channel,
      username: slackSettings.bot_name,
      icon_url: slackSettings.icon_url,
      icon_emoji: slackSettings.icon_emoji,
    });

    expect(setPresenceMock).toHaveBeenCalledWith({ presence: 'auto' });
  });

  it('should throw an error if Slack settings are not provided', async () => {
    organisationServiceMock.getProviderSettings.mockResolvedValue(null);

    await expect(slackService.send(template, organisationId)).rejects.toThrow('Slack settings are not provided!');
  });

  it('should throw an error if message sending to Slack fails', async () => {
    const slackSettings: SlackSettings = { webhook: 'https://hooks.slack.com/services/test/webhook' };
    organisationServiceMock.getProviderSettings.mockResolvedValue(slackSettings);
    mockedAxios.post.mockRejectedValue(new Error('Network Error'));

    await expect(slackService.send(template, organisationId)).rejects.toThrow('Error sending message to Slack');
  });

  it('should throw error when OAuth token fails', async () => {
    const slackSettings: SlackSettings = {
      oAuthToken: 'invalid-token',
      slack_channel: 'random',
    };

    organisationServiceMock.getProviderSettings.mockResolvedValue(slackSettings);

    const postMessageMock = jest.fn().mockRejectedValue(new Error('OAuth error'));

    (WebClient as unknown as jest.Mock).mockImplementation(() => ({
      chat: { postMessage: postMessageMock },
      users: { setPresence: jest.fn() },
    }));

    await expect(slackService.send(template, organisationId)).rejects.toThrow('Error sending message to Slack');
  });
});
