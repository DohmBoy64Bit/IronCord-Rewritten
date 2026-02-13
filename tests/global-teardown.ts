import { stopServices } from './teardown-real-services.js';

export default async function globalTeardown(): Promise<void> {
  console.log('Running global test teardown...');
  
  await stopServices();
  
  console.log('Global test teardown complete');
}
