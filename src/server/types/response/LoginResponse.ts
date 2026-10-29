/**
 * @example
 * {
 *    "access_token": "ya29.a0AXooCgv11nUcbaSrYz4yhSnWEHA4_ym2zJ4bxP5uLAbIepY",
 *    "expiry_date": "1721052768718",
 *    "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjBlMzQ1ZmQ3ZTRhOTcyNzFkZmZhOTkxZjVhODkzY2QxNmI4ZTA",
 *    "refresh_token": "1//0gtsflQHyHt5PCgYIARAAGBASNwF-L9IrtFiFSb2zu492FtzgDzM",
 *    "scope": "https://www.googleapis.com/auth/userinfo.profile openid https://www.googleapis.com/auth/userinfo.email",
 *    "token_type": "Bearer"
 * }
 */

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  id_token: string;
  expiry_date: string;
}
