const ApnsClient = jest.fn().mockImplementation(() => ({
  send: jest.fn().mockResolvedValue({}),
}));

const Notification = jest.fn().mockImplementation((deviceToken, options) => ({
  deviceToken,
  ...options,
}));

module.exports = { ApnsClient, Notification };
