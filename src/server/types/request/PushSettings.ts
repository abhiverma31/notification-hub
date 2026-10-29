import { PushProviders } from '../Enum/PushProviders';

export interface UpdatePushSettingsRequest {
  pushSettings: [
    {
      provider: PushProviders;
      enabled: boolean;
      settings: {
        firebaseClientEmail: string;
        privateKey: string;
        projectId: string;
      };
    },
  ];
}

export interface CreatePushSettingsRequest {
  firebaseClientEmail: string;
  privateKey: string;
  projectId: string;
}

export interface CreatePusherSettingsRequest {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
}

export interface CreatePusherBeamsSettingsRequest {
  instanceId: string;
  secretKey: string;
}
