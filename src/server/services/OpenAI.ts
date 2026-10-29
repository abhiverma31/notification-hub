import { injectable } from 'tsyringe';
import OpenAI from 'openai';
import { ServerLogger } from '../utils/ServerLogger';

@injectable()
export class OpenAIService {
  private readonly logger = new ServerLogger();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  public async generateCompletion(prompt: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });

      const generatedContent = completion.choices[0].message?.content?.trim() || '';

      return generatedContent;
    } catch (error: any) {
      this.logger.error({ error }, 'Error calling OpenAI API');
      throw new Error('Failed to generate content using OpenAI');
    }
  }
}
