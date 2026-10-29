import { HandledConsumerError } from './HandledConsumer';

export class ConfigurationError extends HandledConsumerError {
  constructor(message: string) {
    super(message);
    this.status = 400;
  }
}
