import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const serverDirectory = dirname(dirname(fileURLToPath(import.meta.url)));

// Resolve the same server-local secret regardless of the process working directory.
dotenv.config({ path: join(serverDirectory, '.env') });

export const JWT_SECRET = process.env.JWT_SECRET || 'karma-jwt-2024-secure-admin-key-realtors';
