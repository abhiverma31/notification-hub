import { localEnv, testEnv } from '../constants/EnvironmentConstants';
import dotenv from 'dotenv';
dotenv.config();

export const isLocalOrTest = [localEnv, testEnv].indexOf(process.env.NODE_ENV!.toUpperCase()) > -1;
