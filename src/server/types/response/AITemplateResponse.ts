export interface TeamsTemplateResponse {
  templateName: string;
  text: string;
}
export interface AITemplateResponse<T> {
  message: string;
  templates: T[];
}

export interface EmailTemplateResponse {
  templateName: string;
  subject: string;
  content: string;
}

export interface OnDeckTemplateResponse {
  templateName: string;
  title: string;
  composedMessage: string;
  actionUrl: string;
}

export interface PushTemplateResponse {
  templateName: string;
  title: string;
  composedMessage: string;
}

export interface SlackTemplateResponse {
  templateName: string;
  composedMessage: string;
}
