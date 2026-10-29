export interface WebSocketClientResponse {
  statusCode: number;
  sent: boolean;
  exceptionName?: string;
  message?: string;
}
