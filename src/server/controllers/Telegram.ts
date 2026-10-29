import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { Post, Route, SuccessResponse, Path, Request } from 'tsoa';
import { Controller, Tags } from '@tsoa/runtime';
import { Request as ExRequest } from 'express';
import { TelegramWebhookService } from '../services/TelegramWebhook';
import { OrganisationService } from '../services/Organisation';
import { UnauthorizedError } from '../utils/errors/Unauthorized';
import { logger } from '../utils/ServerLogger';

// Simple in-memory rate limiter: max 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });

    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;

  return false;
}

@injectable()
@Route('api/telegram')
export class TelegramController extends Controller {
  constructor(
    @inject(TelegramWebhookService) private telegramWebhookService: TelegramWebhookService,
    @inject(OrganisationService) private organisationService: OrganisationService,
  ) {
    super();
  }

  /**
   * Telegram bot webhook — called by Telegram when a user messages the bot.
   * User sends `/start <phone_number>` or shares their contact; system links their chat_id to their account.
   * @summary Register Telegram chat_id for a user by phone number
   */
  @Post('{organisationId}/webhook')
  @SuccessResponse('200', 'OK')
  @Tags('Telegram')
  public async webhook(@Path() organisationId: string, @Request() request: ExRequest): Promise<void> {
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      'unknown';

    if (isRateLimited(ip)) {
      logger.warn('Telegram webhook rate limit exceeded', { ip, organisationId });
      this.setStatus(429);

      return;
    }

    // Validate Telegram secret token — fail closed: reject if no secret configured or token mismatch
    const incomingToken = request.headers['x-telegram-bot-api-secret-token'] as string;
    const settings = await this.organisationService.getSettings(organisationId);
    const expectedToken = settings?.telegram?.[0]?.settings?.webhookSecretToken;
    if (!expectedToken || incomingToken !== expectedToken) {
      logger.warn('Invalid or missing Telegram webhook secret token', { organisationId });
      throw new UnauthorizedError();
    }

    await this.telegramWebhookService.handleWebhook(organisationId, request.body);
  }
}
