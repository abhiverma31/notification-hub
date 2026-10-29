import { FieldErrors, ValidateError } from '@tsoa/runtime';
import { Data } from '../types/Interfaces/Template';
import { logger } from '../utils/ConsumerLogger';

interface NestedObject {
  [key: string]: string | NestedObject | string[];
}

function propertiesToObject(obj: NestedObject): Data {
  const isObject = (val: any): val is NestedObject => val && typeof val === 'object' && !Array.isArray(val);

  const addDelimiter = (a: string, b: string): string => (a ? `${a}.${b}` : b);

  const paths = (obj: NestedObject = {}, head: string = ''): Data => {
    return Object.entries(obj).reduce((product: { [key: string]: string }, [key, value]: [string, any]) => {
      const fullPath = addDelimiter(head, key);
      if (isObject(value)) {
        return { ...product, ...paths(value, fullPath) };
      } else if (Array.isArray(value)) {
        return { ...product, [fullPath]: value.join(', ') };
      } else {
        return { ...product, [fullPath]: value };
      }
    }, {});
  };

  return paths(obj);
}

export const replacePlaceholders = (content: string, recipient?: Data, data?: Data): string => {
  if (typeof content !== 'string') {
    return content;
  }

  if (recipient || data) {
    const flattenedRecipient = recipient ? propertiesToObject(recipient!) : {};
    const placeholders = content.match(/{{(?:recipient|data)*\.(.*?)}}/g) || [];
    let message = content;
    logger.info('Placeholders:: ', placeholders);

    let errorFields: FieldErrors | null = null;

    placeholders.forEach((placeholder) => {
      const field: string = placeholder.slice(2, -2).trim();
      const parts = field.split('.');
      const key = parts[0];
      const value = parts.slice(1).join('.');

      let replaceValue = ' ';
      if (key === 'recipient') {
        replaceValue = flattenedRecipient[value];
      } else {
        if (key === 'data' && data === undefined) {
          errorFields ??= {};
          errorFields[field] = { message: 'Data parameter is undefined', value: null };
        }
        replaceValue = data![value];
      }

      logger.info('replaceValue :', replaceValue);

      if (replaceValue !== undefined) {
        message = message.replace(placeholder, replaceValue);
      } else {
        errorFields ??= {};
        errorFields[field] = { message: 'Placeholder was not populated', value: null };
      }
    });

    if (errorFields !== null) {
      logger.info('Error Fields: ', errorFields);
      throw new ValidateError(errorFields, 'Validation Error');
    }

    logger.info('Hydrated Message: ', message);

    return message;
  }

  return content;
};
