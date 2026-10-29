import 'reflect-metadata';
import { MembersController } from './../../../../src/server/controllers/Member';
import { NHRequest, NHRequestUser } from '../../../../src/server/types/internal/NHRequest';
import { OrganisationInterface } from '../../../../src/shared-library/models/Organisation';
import { MemberInterface } from '../../../../src/shared-library/models/Member';

describe('MembersController', () => {
  let membersController: MembersController;

  beforeEach(() => {
    membersController = new MembersController();
    membersController.setStatus = jest.fn();
  });

  it('should get member details successfully', async () => {
    const member: MemberInterface = { _id: 'mocked-id', name: { first: 'John', last: 'Doe' }, email: 'test@gmail.com' };
    const organisation: OrganisationInterface = {
      _id: 'org-id',
      name: 'Test Organisation',
      api_key: 'apiKey',
      api_secret_hash: 'api_secret_hash',
    };
    const user: NHRequestUser = { member: member, organisation: organisation, role: 'admin' };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };

    const res = await membersController.getMember(request as NHRequest);

    expect(res).toStrictEqual({
      member: {
        name: { first: 'John', last: 'Doe' },
      },
      organisation: {
        name: 'Test Organisation', id: 'org-id',
      },
    });
  });
});
