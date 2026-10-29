export default jest.fn().mockImplementation(() => ({
  publishToInterests: jest.fn().mockResolvedValue({}),
}));
