import { execSync } from 'child_process';

function executeCommand(command: string, ignoreErrors = false): void {
  try {
    execSync(command, { stdio: 'inherit', windowsHide: true });
  } catch (error) {
    if (!ignoreErrors) {
      console.error(`Command failed: ${command}`);
      throw error;
    }
  }
}

async function stopServices(): Promise<void> {
  console.log('Stopping test services...');
  
  executeCommand('podman compose -f podman-compose.test.yml down --volumes', true);
  
  console.log('✓ Test services stopped and cleaned up');
}

export { stopServices };

stopServices()
  .then(() => {
    console.log('\n✓ Test infrastructure teardown complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Failed to teardown test infrastructure:', error);
    process.exit(1);
  });
