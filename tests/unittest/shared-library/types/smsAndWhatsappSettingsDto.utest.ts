import { SmsAndWhatsappSettingsDto } from '../../../../src/shared-library/types/Dto/SmsAndWhatsappSettingsDto';
import { SmsProviders } from '../../../../src/server/types/Enum/SmsProviders';

describe('SmsAndWhatsappSettingsDto', () => {
  describe('validate - Twilio SMS', () => {
    it('should pass with valid Twilio settings', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: SmsProviders.TWILIO, enabled: true, settings: { smsNumber: '+1234567890', auth: { accountSid: 'sid', authToken: 'token' } } }],
        [],
      );
      expect(() => dto.validate()).not.toThrow();
    });

    it('should throw when smsNumber is missing', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: SmsProviders.TWILIO, enabled: true, settings: { smsNumber: '', auth: { accountSid: 'sid', authToken: 'token' } } }],
        [],
      );
      expect(() => dto.validate()).toThrow('Invalid smsNumber in SMS settings');
    });

    it('should throw when auth is missing', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: SmsProviders.TWILIO, enabled: true, settings: { smsNumber: '+123', auth: { accountSid: '', authToken: 'token' } } }],
        [],
      );
      expect(() => dto.validate()).toThrow('Invalid Twilio settings in SMS settings');
    });
  });

  describe('validate - Gupshup SMS', () => {
    it('should pass with valid Gupshup settings', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: SmsProviders.GUPSHUP, enabled: true, settings: { userid: 'user1', password: 'pass1', mask: 'SENDER' } as any }],
        [],
      );
      expect(() => dto.validate()).not.toThrow();
    });

    it('should throw when userid is missing', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: SmsProviders.GUPSHUP, enabled: true, settings: { userid: '', password: 'pass1', mask: 'SENDER' } as any }],
        [],
      );
      expect(() => dto.validate()).toThrow('Invalid userid in Gupshup SMS settings');
    });

    it('should throw when password is missing', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: SmsProviders.GUPSHUP, enabled: true, settings: { userid: 'user1', password: '', mask: 'SENDER' } as any }],
        [],
      );
      expect(() => dto.validate()).toThrow('Invalid password in Gupshup SMS settings');
    });

    it('should throw when mask is missing', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: SmsProviders.GUPSHUP, enabled: true, settings: { userid: 'user1', password: 'pass1', mask: '' } as any }],
        [],
      );
      expect(() => dto.validate()).toThrow('Invalid mask (sender ID) in Gupshup SMS settings');
    });

    it('should throw when settings are missing', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: SmsProviders.GUPSHUP, enabled: true, settings: undefined as any }],
        [],
      );
      expect(() => dto.validate()).toThrow('SMS settings are required');
    });
  });

  describe('validate - unknown provider', () => {
    it('should not throw for unknown provider with settings present', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: 'unknown' as any, enabled: true, settings: { anything: 'value' } as any }],
        [],
      );
      expect(() => dto.validate()).not.toThrow();
    });

    it('should throw when settings are missing regardless of provider', () => {
      const dto = new SmsAndWhatsappSettingsDto(
        [{ provider: 'unknown' as any, enabled: true, settings: undefined as any }],
        [],
      );
      expect(() => dto.validate()).toThrow('SMS settings are required');
    });
  });
});
