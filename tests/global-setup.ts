import { startServices } from './setup-real-services.js';
import { setTestEnv } from './helpers.js';

export default async function globalSetup(): Promise<void> {
  console.log('Running global test setup...');
  
  setTestEnv();
  
  await startServices();
  
  console.log('Global test setup complete');
}
