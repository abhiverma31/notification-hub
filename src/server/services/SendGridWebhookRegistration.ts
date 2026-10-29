import 'reflect-metadata';
import { injectable } from 'tsyringe';
import axios, { AxiosError } from 'axios';
import { ServerLogger } from '../utils/ServerLogger';

const SENDGRID_API_BASE_URL = 'https://api.sendgrid.com';
const WEBHOOK_PATH = '/api/webhooks/sendgrid/events';
const FRIENDLY_NAME = 'EasyNotify Event Webhook';
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

interface HttpRequestConfig {
  method: 'get' | 'post' | 'patch' | 'delete';
  url: string;
  headers: Record<string, string>;
  data?: unknown;
}

interface SendGridWebhookConfig {
  enabled: boolean;
  url: string;
  delivered: boolean;
  bounce: boolean;
  deferred: boolean;
  dropped: boolean;
  processed: boolean;
  open: boolean;
  click: boolean;
  spam_report: boolean;
  friendly_name: string;
}

interface SendGridWebhookResponse extends SendGridWebhookConfig {
  id: string;
  created_date: string | null;
  updated_date: string;
}

interface GetAllWebhooksResponse {
  max_allowed: number;
  webhooks: SendGridWebhookResponse[];
}

export type RegistrationResult =
  | { status: 'created'; webhookId: string }
  | { status: 'updated'; webhookId: string }
  | { status: 'already-configured'; webhookId: string }
  | { status: 'insufficient-permissions' }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string };

@injectable()
export class SendGridWebhookRegistrationService {
  private readonly logger = new ServerLogger('SendGridWebhookRegistration');

  public async register(apiKey: string): Promise<RegistrationResult> {
    const baseUrl = process.env.SERVER_URL;
    if (!baseUrl) {
      return { status: 'skipped', reason: 'SERVER_URL not configured' };
    }

    const webhookUrl = `${baseUrl}${WEBHOOK_PATH}`;
    const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

    try {
      const existing = await this.findExistingWebhook(headers, webhookUrl);

      if (existing && this.isCorrectlyConfigured(existing)) {
        return { status: 'already-configured', webhookId: existing.id };
      }

      if (existing) {
        return await this.updateWebhook(headers, existing.id, webhookUrl);
      }

      return await this.createWebhook(headers, webhookUrl);
    } catch (err) {
      return this.handleError(err);
    }
  }

  private async requestWithRetry<T>(config: HttpRequestConfig, attempt = 1): Promise<T> {
    try {
      return await this.executeRequest<T>(config);
    } catch (err) {
      const isRetryable =
        err instanceof AxiosError && (!err.response || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT');
      if (isRetryable && attempt <= MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn('SendGrid request failed, retrying', { attempt, code: (err as AxiosError).code });
        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.requestWithRetry<T>(config, attempt + 1);
      }
      throw err;
    }
  }

  private async executeRequest<T>(config: HttpRequestConfig): Promise<T> {
    const { method, url, data, headers } = config;
    const options = { headers, timeout: REQUEST_TIMEOUT_MS };
    switch (method) {
      case 'get':
        return (await axios.get(url!, options)).data;
      case 'delete':
        return (await axios.delete(url!, options)).data;
      case 'patch':
        return (await axios.patch(url!, data, options)).data;
      case 'post':
      default:
        return (await axios.post(url!, data, options)).data;
    }
  }

  public async disable(apiKey: string, webhookId: string): Promise<void> {
    const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    try {
      await this.requestWithRetry({
        method: 'patch',
        url: `${SENDGRID_API_BASE_URL}/v3/user/webhooks/event/settings/${webhookId}`,
        data: { enabled: false },
        headers,
      });
    } catch (err) {
      this.logger.error('Failed to disable SendGrid webhook', { webhookId, error: err });
    }
  }

  public async deleteWebhook(apiKey: string, webhookId: string): Promise<void> {
    const headers = { Authorization: `Bearer ${apiKey}` };
    try {
      await this.requestWithRetry({
        method: 'delete',
        url: `${SENDGRID_API_BASE_URL}/v3/user/webhooks/event/settings/${webhookId}`,
        headers,
      });
    } catch (err) {
      this.logger.error('Failed to delete SendGrid webhook', { webhookId, error: err });
    }
  }

  private async findExistingWebhook(
    headers: Record<string, string>,
    webhookUrl: string,
  ): Promise<SendGridWebhookResponse | undefined> {
    const data = await this.requestWithRetry<GetAllWebhooksResponse>({
      method: 'get',
      url: `${SENDGRID_API_BASE_URL}/v3/user/webhooks/event/settings/all`,
      headers,
    });

    return data.webhooks.find((wh) => wh.url === webhookUrl);
  }

  private isCorrectlyConfigured(webhook: SendGridWebhookResponse): boolean {
    return (
      webhook.enabled &&
      webhook.delivered &&
      webhook.bounce &&
      webhook.deferred &&
      webhook.dropped &&
      webhook.processed &&
      webhook.open &&
      webhook.click &&
      webhook.spam_report
    );
  }

  private buildWebhookConfig(webhookUrl: string): SendGridWebhookConfig {
    return {
      enabled: true,
      url: webhookUrl,
      delivered: true,
      bounce: true,
      deferred: true,
      dropped: true,
      processed: true,
      open: true,
      click: true,
      spam_report: true,
      friendly_name: FRIENDLY_NAME,
    };
  }

  private async createWebhook(headers: Record<string, string>, webhookUrl: string): Promise<RegistrationResult> {
    const data = await this.requestWithRetry<SendGridWebhookResponse>({
      method: 'post',
      url: `${SENDGRID_API_BASE_URL}/v3/user/webhooks/event/settings`,
      data: this.buildWebhookConfig(webhookUrl),
      headers,
    });
    this.logger.info('SendGrid webhook created', { webhookId: data.id });

    return { status: 'created', webhookId: data.id };
  }

  private async updateWebhook(
    headers: Record<string, string>,
    webhookId: string,
    webhookUrl: string,
  ): Promise<RegistrationResult> {
    await this.requestWithRetry({
      method: 'patch',
      url: `${SENDGRID_API_BASE_URL}/v3/user/webhooks/event/settings/${webhookId}`,
      data: this.buildWebhookConfig(webhookUrl),
      headers,
    });
    this.logger.info('SendGrid webhook updated', { webhookId });

    return { status: 'updated', webhookId };
  }

  private handleError(err: unknown): RegistrationResult {
    if (err instanceof AxiosError && err.response?.status === 403) {
      this.logger.warn('SendGrid API key lacks webhook permissions (403)');

      return { status: 'insufficient-permissions' };
    }
    this.logger.error('SendGrid webhook registration failed', { error: err });
    const message = err instanceof Error ? err.message : 'Unknown error';

    return { status: 'error', reason: message };
  }
}
