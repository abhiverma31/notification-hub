import { CreateOrganisationRequest } from '../../../server/types/request/CreateOrganisation';
import { ApiKey } from '../../../server/types/internal/ApiKey';
import { OrganisationInterface } from '../Organisation';

export function adaptToOrganisationInterface(
  create: CreateOrganisationRequest,
  apiKey: ApiKey,
  baseEncodedOrgKey: string,
): OrganisationInterface {
  return {
    name: create.name,
    api_key: apiKey.key,
    api_secret_hash: apiKey.secret_hash,
    x_org_key: baseEncodedOrgKey,
  };
}
