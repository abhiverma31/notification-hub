import { PriorityEnum } from '../types/Enum/PriorityEnum';

export function isValidPriorityEnum(value: string): value is PriorityEnum {
  return Object.values(PriorityEnum).includes(value as PriorityEnum);
}
