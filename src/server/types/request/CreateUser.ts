import { UserName } from '../../../shared-library/models/User';

/**
 *
 * @example
 * {
 *   "email": "JohnDoe@technogise.com",
 *   "name": {
 *     "first_name": "John",
 *     "last_name": "Doe"
 *   },
 *   "phone_number": "1234567890"
 * }
 */

export interface CreateUser {
  email?: string;
  name: UserName;
  phone_number?: string;
  external_user_id?: string;
  telegram_chat_id?: string;
}
