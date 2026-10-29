import 'reflect-metadata';
import { ValidateError } from '@tsoa/runtime';
import { replacePlaceholders } from '../../../../src/consumer/helper/ReplacePlaceholders';
import { Data } from '../../../../src/consumer/types/Interfaces/Template';
import { Recipient } from '../../../../src/shared-library/types/Dto/Recipient';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { getError, NoErrorThrownError } from '../../../common/errors/NoErrorThrown';

describe('replacePlaceholders', () => {
  it('should replace placeholders with values from recipient and data', () => {
    const template = `Hello, {{recipient.name.first}}. Get a {{data.discountPercent}}% discount!`;
    const data: Data = { name: 'Alice', discountPercent: '20' };
    const recipient: Recipient = {
      channel: ChannelType.EMAIL,
      email: 'test@test.com',
      name: { first: 'Alice' },
    };
    const result = replacePlaceholders(template, recipient as any, data);

    expect(result).toBe('Hello, Alice. Get a 20% discount!');
  });

  it('should throw a ValidateError if a placeholder is missing data', async () => {
    const template = `Hello, {{recipient.name.first}}. Your age is {{data.age}}.`;
    const data: Data = { name: 'Bob' }; // Missing age property
    const recipient: Recipient = {
      channel: ChannelType.EMAIL,
      email: 'test@test.com',
      name: { first: 'Bob' },
    };
    const error = await getError(async () => replacePlaceholders(template, recipient as any, data));

    expect(error).not.toBeInstanceOf(NoErrorThrownError);
    expect(error).toBeInstanceOf(ValidateError);

    const validateError: ValidateError = error as ValidateError;

    expect(validateError.fields).toStrictEqual({
      'data.age': {
        message: 'Placeholder was not populated',
        value: null,
      },
    });
    expect(validateError.name).toStrictEqual('ValidateError');
    expect(validateError.status).toStrictEqual(400);
  });
});
