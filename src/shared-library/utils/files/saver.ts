import fs from 'fs';
import path from 'path';

export const saveToTemporaryFile = (buffer: Buffer, filename: string): string => {
  const tempPath = path.join('/tmp', filename);
  fs.writeFileSync(tempPath, buffer);

  return tempPath;
};
