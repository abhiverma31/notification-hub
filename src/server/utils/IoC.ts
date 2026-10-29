import { IocContainer } from '@tsoa/runtime';
import { container } from 'tsyringe';
import { constructor } from 'tsyringe/dist/typings/types';

export const iocContainer: IocContainer = {
  get: <T>(controller: constructor<T> | string | symbol): T => {
    return container.resolve<T>(controller);
  },
};
