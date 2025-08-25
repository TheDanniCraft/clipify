import { getEmailProvider } from '../newsletter';

describe('getEmailProvider', () => {
  it('should identify Google/Gmail emails correctly', async () => {
    expect(await getEmailProvider('user@gmail.com')).toBe('Google');
    expect(await getEmailProvider('user@googlemail.com')).toBe('Google');
    expect(await getEmailProvider('USER@GMAIL.COM')).toBe('Google'); // Case insensitive
  });

  it('should identify Microsoft emails correctly', async () => {
    expect(await getEmailProvider('user@outlook.com')).toBe('Microsoft');
    expect(await getEmailProvider('user@hotmail.com')).toBe('Microsoft');
    expect(await getEmailProvider('user@live.com')).toBe('Microsoft');
    expect(await getEmailProvider('user@msn.com')).toBe('Microsoft');
  });

  it('should identify Yahoo emails correctly', async () => {
    expect(await getEmailProvider('user@yahoo.com')).toBe('Yahoo');
    expect(await getEmailProvider('user@yahoo.co.uk')).toBe('Yahoo');
    expect(await getEmailProvider('user@ymail.com')).toBe('Yahoo');
  });

  it('should identify Apple emails correctly', async () => {
    expect(await getEmailProvider('user@icloud.com')).toBe('Apple');
    expect(await getEmailProvider('user@me.com')).toBe('Apple');
    expect(await getEmailProvider('user@mac.com')).toBe('Apple');
  });

  it('should identify other popular email providers', async () => {
    expect(await getEmailProvider('user@aol.com')).toBe('AOL');
    expect(await getEmailProvider('user@protonmail.com')).toBe('ProtonMail');
    expect(await getEmailProvider('user@pm.me')).toBe('ProtonMail');
    expect(await getEmailProvider('user@gmx.com')).toBe('GMX');
    expect(await getEmailProvider('user@gmx.de')).toBe('GMX');
  });

  it('should identify regional email providers', async () => {
    expect(await getEmailProvider('user@web.de')).toBe('WEB.DE');
    expect(await getEmailProvider('user@t-online.de')).toBe('T-Online');
    expect(await getEmailProvider('user@yandex.com')).toBe('Yandex');
    expect(await getEmailProvider('user@yandex.ru')).toBe('Yandex');
    expect(await getEmailProvider('user@qq.com')).toBe('NetEase');
    expect(await getEmailProvider('user@163.com')).toBe('NetEase');
  });

  it('should identify Korean email providers', async () => {
    expect(await getEmailProvider('user@naver.com')).toBe('Korea Mail');
    expect(await getEmailProvider('user@hanmail.net')).toBe('Korea Mail');
    expect(await getEmailProvider('user@daum.net')).toBe('Korea Mail');
  });

  it('should identify telecom providers', async () => {
    expect(await getEmailProvider('user@shaw.ca')).toBe('Shaw');
    expect(await getEmailProvider('user@telus.net')).toBe('Telus');
    expect(await getEmailProvider('user@btinternet.com')).toBe('BT');
    expect(await getEmailProvider('user@att.net')).toBe('AT&T');
  });

  it('should return "custom" for unknown email providers', async () => {
    expect(await getEmailProvider('user@example.com')).toBe('custom');
    expect(await getEmailProvider('user@unknown-provider.com')).toBe('custom');
    expect(await getEmailProvider('user@mydomain.org')).toBe('custom');
  });

  it('should handle edge cases', async () => {
    expect(await getEmailProvider('user@UNKNOWN.COM')).toBe('custom');
    expect(await getEmailProvider('test.email+tag@gmail.com')).toBe('Google');
    expect(await getEmailProvider('user.name@outlook.com')).toBe('Microsoft');
  });

  it('should handle complex email addresses', async () => {
    expect(await getEmailProvider('first.last+tag@gmail.com')).toBe('Google');
    expect(await getEmailProvider('user123@yahoo.co.uk')).toBe('Yahoo');
    expect(await getEmailProvider('test_email@icloud.com')).toBe('Apple');
  });
});