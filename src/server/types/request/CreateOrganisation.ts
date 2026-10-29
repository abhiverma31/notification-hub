import {
  NodemailerSettings,
  SlackSettings,
  SmsSettings,
  TeamsSettings,
  TelegramSettings,
  WhatsappSettings,
} from '../../../shared-library/models/submodels/OrganisationSettings';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';
import { EmailProviders } from '../Enum/EmailProviders';
import { PushProviders } from '../Enum/PushProviders';
import { SlackProviders } from '../Enum/SlackProvider';
import { TeamsProviders } from '../Enum/TeamProviders';
import { TelegramProviders } from '../Enum/TelegramProviders';
import {
  CreatePushSettingsRequest,
  CreatePusherSettingsRequest,
  CreatePusherBeamsSettingsRequest,
} from './PushSettings';
import { WhatsappProviders } from '../Enum/WhatsappProviders';
import { SmsProviders } from '../Enum/SmsProviders';

/**
 * @example
 {
   "name": "Technogise"
 }
 */
export interface CreateOrganisationRequest {
  name: string;
}

// /**
//  * @example
//  * {
//  *  "channelType": "push",
//     "provider": "firebase",
//     "enabled": true,
//     "settings" :{
//       "firebaseClientEmail": "firebase-adminsdk-cezsj@aarambh-87cdd.iam.gserviceaccount.com",
//       "privateKey":"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCzmFVQQ2WlBkoO\nRHFTTrYCLnPaSIPUlP6F1IwyDh0Ov6wWEN4qUQL5qkZulQn1kWZ9jOGZ5w1EOT9t\nqDOb+YR8HJ6XwJAc7AY8jf1nfLCfWEhDNJyKR6a/b4cSm8txQc3IEi0s/8tI0R4H\nh/vp+IYvZDtCmD1cdspaQPzWHTWCfmJ6p3uGLmGYKvikQ0LRp4cASUodlHSpL8ep\nvmkvdc9Hd0U5fNTCzIWaSHYbK0CiQMQSw+tSGVCkZwqwK9xxavpbq76tgvbFp02G\nWxIm3GF/8m951nTBsFOs2kwEbyjJT4q6PGW31uykLVckmlaNArYSwNTru+uuLC3l\nC0OB3N9LAgMBAAECggEAEQZFPBUPexvEBGM3jOqetUk7ATuzh4DSOdSCr7IHziCc\nSwExVjiUvB8Iiy4Eois02Hz029Z7uvZkTVxO/B+kj/FUlVUTNDKpiq75EQjQY2KG\ngxxnJHKTW31ShBCRsfxHagpTDvt2hUIRgyxAVJcS/UYWmgL9ehjmqLSVYySksGhq\n1vlLRayAFLrvT1VSrdg8RgTdRAT9pR2XNED+/35aW7UI0yle6bqtqafs3UJ1vOvp\n4ryBGseLMBOba9p9mNKJRNPp7TrA6CoE5bJ/H03cUx1lANXhXl9tD1iQOqRBaarO\nUMfP4huJP3fGwWUSWUe47GGtYPhfgAQMQuhSRbtSQQKBgQDprStrbmcMFHN7P1tm\nM9oBsVFsfh6WqYt3yyr3RskcujT6hnJtIFm886EeG5rgCXKfF8boJzjxSsvPyKzy\nHIajZ0LfYHppSJ4JbFcioba6eSAnyXc8aGIv+s4hDBK6AOkJdMRxHmcr/EaV70SR\nipktglxrbfVOLdkMJF8vAoBLiwKBgQDEwIo/pbnzqI4ti0jngkJhLgm3onU+Bxc0\niOsfo5jHpb2P249WGMVt62I9BUIAUjC9oGDNYV3uqfLGZHXaD/zqgLvAChBwMYbn\nhUg+ezzI9jn5I3Kun7IXIv3TG51PsfQ87PM9pHu/9IZ2/K6kwBDOTZIPGN6ZXVE0\nTDeUbFczQQKBgQCOdWYtHqdv89/bWWrNSfs0YPe03sajL0W5iIDvM5ZUDylROjn0\nUW6kBRtKkaW/w8K/Pu2ihpbuc50BVeQpzj4+zCs2p0i5eu3t7MDKejA+Sq3R077/\nctu5SHv2Jbgc8YUgoLFKDTD03d3idnYlDIwJ9JmHXQfZ25WhE2N781hntQKBgG0P\nKNKk41EbYkv+g9fHzVGeukYu5/wM5CD7sBDmlt47kbq3Alm/+1e1fMvEKVSSOnAy\nANZ3HSEY1PiBYQ4RhKjb2LZXHcuCuHuG1ofDuerPCU1/B6eh346Rl8635NfzFSXc\nVewaS3oYaZx07b1mtSoVt1tk9qZeIo/xm3FLKH7BAoGBAM7AaTxvnmGdSfRe/9tJ\nnuCNRS9ep3A+aGeBbICYaPptwnhvh3d3DraK8kkrPjAO8FISLXNNMXxb/m85oLZB\nYWs30T5nH1RwYDaS2FgThY0nSErVPYqH/HaGFB4qR6ONS+eTo2MZYXQe64kb9rzT\nDccZGlSEkiEb6z04veMHI6L3\n-----END PRIVATE KEY-----\n",
//     "projectId": "aarambh-87cdd"
//     }
//  * }
//  */

/**
 *
 * @example
 * {
 *   "channelType": "email",
 *   "provider": "GMAIL",
 *   "enabled": true,
 *   "settings": {
 *     "auth": {
 *       "user": "john@technogise.com",
 *       "pass": "iokphspryktchphb"
 *     },
 *     "service": "Gmail",
 *     "port": "587",
 *     "host": "smtp.gmail.com",
 *     "secure": true
 *   }
 * }
 */

export interface CreateProviderSettingRequest {
  channelType: ChannelType;
  provider:
    | PushProviders
    | EmailProviders
    | SlackProviders
    | WhatsappProviders
    | SmsProviders
    | TeamsProviders
    | TelegramProviders;
  enabled: boolean;
  settings:
    | CreatePushSettingsRequest
    | CreatePusherSettingsRequest
    | CreatePusherBeamsSettingsRequest
    | NodemailerSettings
    | SlackSettings
    | SmsSettings
    | WhatsappSettings
    | TeamsSettings
    | TelegramSettings;
}
