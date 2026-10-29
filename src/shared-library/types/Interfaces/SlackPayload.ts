export interface SlackPayload {
  text: string;
  channel: string;
  username: string;
  icon_emoji: string;
  icon_url: string;
  always_online: boolean;
}
