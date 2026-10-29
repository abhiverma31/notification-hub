import {
  OrganisationSettingsInterface,
  PushProvider,
} from '../../src/shared-library/models/submodels/OrganisationSettings';
import { PushProviders } from '../../src/server/types/Enum/PushProviders';
import { CreateOrganisationRequest } from '../../src/server/types/request/CreateOrganisation';
import { adaptToOrganisationInterface } from '../../src/shared-library/models/adapters/CreateOrganisation';
import { OrganisationInterface } from '../../src/shared-library/models/Organisation';
import { ApiKey } from '../../src/server/types/internal/ApiKey';

const pushProviderSettings: PushProvider = {
  enabled: true,
  settings: {
    firebaseClientEmail: 'firebase-adminsdk-cezsj@aarambh-87cdd.iam.gserviceaccount.com',
    projectId: 'aarambh-87cdd',
    privateKey:
      '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',
  },
  provider: PushProviders.FIREBASE,
};

export function getSeedOrganisation(apiKey: ApiKey,baseEncodedOrgKey:string): OrganisationInterface {
  const createOrganisation: CreateOrganisationRequest = { name: 'testOrg' };
  const orgInterface = adaptToOrganisationInterface(createOrganisation, apiKey,baseEncodedOrgKey);
  orgInterface.settings = {} as OrganisationSettingsInterface;
  orgInterface.settings.push = [];

  if (orgInterface.settings && orgInterface.settings.push) {
    orgInterface.settings.push.push(pushProviderSettings);
  }

  return orgInterface;
}
