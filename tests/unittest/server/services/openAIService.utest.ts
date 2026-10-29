import 'reflect-metadata';
import { OpenAIService } from '../../../../src/server/services/OpenAI';
import OpenAI from 'openai';

jest.mock('openai');
jest.mock('../../../../src/server/utils/ServerLogger');

describe('OpenAIService', () => {
  let openAIService: OpenAIService;
  let openaiMock: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();

    openaiMock = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as unknown as jest.Mocked<OpenAI>;

    (OpenAI as jest.Mock).mockImplementation(() => openaiMock);

    process.env.OPENAI_API_KEY = 'test-api-key';

    openAIService = new OpenAIService();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('generateCompletion', () => {
    it('should return generated content when OpenAI API call is successful', async () => {
      const prompt = 'Test prompt';
      const expectedContent = 'Generated content';

      openaiMock.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: expectedContent,
            },
          },
        ],
      } as any);

      const result = await openAIService.generateCompletion(prompt);

      expect(openaiMock.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });

      expect(result).toBe(expectedContent);
    });

    it('should throw an error when OpenAI API call fails', async () => {
      const prompt = 'Test prompt';
      const errorMessage = 'OpenAI API error';

      openaiMock.chat.completions.create.mockRejectedValue(new Error(errorMessage));

      await expect(openAIService.generateCompletion(prompt)).rejects.toThrow('Failed to generate content using OpenAI');

      expect(openaiMock.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });
    });

    it('should return empty string when content is undefined', async () => {
      const prompt = 'Test prompt';

      openaiMock.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: undefined,
            },
          },
        ],
      } as any);

      const result = await openAIService.generateCompletion(prompt);

      expect(result).toBe('');
    });

    it('should trim whitespace from generated content', async () => {
      const prompt = 'Test prompt';
      const contentWithWhitespace = '  Generated content  ';

      openaiMock.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: contentWithWhitespace,
            },
          },
        ],
      } as any);

      const result = await openAIService.generateCompletion(prompt);

      expect(result).toBe('Generated content');
    });
  });
});
