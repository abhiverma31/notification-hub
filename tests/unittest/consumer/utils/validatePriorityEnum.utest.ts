import { isValidPriorityEnum } from "../../../../src/consumer/utils/ValidatePriorityEnum";

describe('isValidPriorityEnum', () => {

  it('should return true for a valid enum value (HIGH)', () => {
    expect(isValidPriorityEnum('high')).toBe(true);
  });

  it('should return true for a valid enum value (HIGH)', () => {
    expect(isValidPriorityEnum('normal')).toBe(true);
  });

  it('should return false for an invalid enum value', () => {
    expect(isValidPriorityEnum('low')).toBe(false);
  });

  it('should return false for a non-string value', () => {
    // @ts-expect-error: Testing invalid input
    expect(isValidPriorityEnum(123)).toBe(false);
  });

});