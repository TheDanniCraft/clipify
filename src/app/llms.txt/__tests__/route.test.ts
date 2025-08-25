/**
 * @jest-environment node
 */
import { GET } from '../route';
import fs from 'fs/promises';
import path from 'path';

// Mock fs.readFile
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('/llms.txt route', () => {
  const mockedReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return text/plain content type', async () => {
    const mockContent = 'Test content for llms.txt';
    mockedReadFile.mockResolvedValue(mockContent);

    const response = await GET();

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
  });

  it('should read the correct file path', async () => {
    const mockContent = 'Test content for llms.txt';
    mockedReadFile.mockResolvedValue(mockContent);

    await GET();

    expect(mockedReadFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'src', 'app', 'llms.txt', 'llms.txt'),
      'utf-8'
    );
  });

  it('should return the file content as response body', async () => {
    const mockContent = 'Test content for llms.txt';
    mockedReadFile.mockResolvedValue(mockContent);

    const response = await GET();
    const text = await response.text();

    expect(text).toBe(mockContent);
  });

  it('should throw error when file reading fails', async () => {
    const mockError = new Error('File not found');
    mockedReadFile.mockRejectedValue(mockError);

    await expect(GET()).rejects.toThrow('File not found');
  });
});