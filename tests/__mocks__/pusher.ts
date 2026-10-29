export default jest.fn().mockImplementation(() => ({
  trigger: jest.fn().mockResolvedValue({}),
}));
