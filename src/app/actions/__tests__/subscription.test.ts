import { getPlans } from '../subscription';

describe('getPlans', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should return dev plans when NODE_ENV is not production', async () => {
    process.env.NODE_ENV = 'development';
    const plans = await getPlans();
    expect(plans).toEqual(["price_1RaLC2B0sp7KYCWLkJGjDq3q", "price_1Ru0WHB0sp7KYCWLBbdT0ZH7"]);
  });

  it('should return dev plans when NODE_ENV is test', async () => {
    process.env.NODE_ENV = 'test';
    const plans = await getPlans();
    expect(plans).toEqual(["price_1RaLC2B0sp7KYCWLkJGjDq3q", "price_1Ru0WHB0sp7KYCWLBbdT0ZH7"]);
  });

  it('should return prod plans when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    const plans = await getPlans();
    expect(plans).toEqual(["price_1RaJ4ZB0sp7KYCWLOst1iqLA", "price_1RaJQdB0sp7KYCWLlfTgeJ7Z"]);
  });

  it('should return dev plans when NODE_ENV is undefined', async () => {
    delete process.env.NODE_ENV;
    const plans = await getPlans();
    expect(plans).toEqual(["price_1RaLC2B0sp7KYCWLkJGjDq3q", "price_1Ru0WHB0sp7KYCWLBbdT0ZH7"]);
  });

  it('should return dev plans when NODE_ENV is empty string', async () => {
    process.env.NODE_ENV = '';
    const plans = await getPlans();
    expect(plans).toEqual(["price_1RaLC2B0sp7KYCWLkJGjDq3q", "price_1Ru0WHB0sp7KYCWLBbdT0ZH7"]);
  });
});