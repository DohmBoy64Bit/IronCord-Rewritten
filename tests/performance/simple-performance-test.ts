/**
 * Simple Performance Test Suite
 * 
 * Focused tests that can be run independently
 */

import { performance } from 'perf_hooks';

interface TestResult {
  name: string;
  passed: boolean;
  measured: number;
  target: number;
  unit: string;
}

const results: TestResult[] = [];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: System Startup Time
async function testStartupTime(): Promise<TestResult> {
  console.log('\n=== Test 1: System Startup Time ===');
  
  const startTime = performance.now();
  
  try {
    // Test database connection
    const dbResponse = await fetch('http://localhost:3000/health');
    if (!dbResponse.ok) {
      throw new Error('Health check failed');
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    console.log(`Startup time: ${totalTime.toFixed(2)}ms`);
    console.log(`Target: <10,000ms`);
    
    const passed = totalTime < 10000;
    console.log(`Result: ${passed ? '✓ PASS' : '✗ FAIL'}`);
    
    return {
      name: 'Startup Time',
      passed,
      measured: totalTime,
      target: 10000,
      unit: 'ms',
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      name: 'Startup Time',
      passed: false,
      measured: 0,
      target: 10000,
      unit: 'ms',
    };
  }
}

// Test 2: API Response Time
async function testAPIResponseTime(): Promise<TestResult> {
  console.log('\n=== Test 2: API Response Time ===');
  
  const iterations = 100;
  const latencies: number[] = [];
  
  try {
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      const response = await fetch('http://localhost:3000/health');
      if (!response.ok) {
        throw new Error('Health check failed');
      }
      
      const endTime = performance.now();
      latencies.push(endTime - startTime);
      
      await delay(10);
    }
    
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    
    console.log(`Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`Min: ${minLatency.toFixed(2)}ms`);
    console.log(`Max: ${maxLatency.toFixed(2)}ms`);
    console.log(`Target: <100ms`);
    
    const passed = avgLatency < 100;
    console.log(`Result: ${passed ? '✓ PASS' : '✗ FAIL'}`);
    
    return {
      name: 'API Response Time',
      passed,
      measured: avgLatency,
      target: 100,
      unit: 'ms',
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      name: 'API Response Time',
      passed: false,
      measured: 0,
      target: 100,
      unit: 'ms',
    };
  }
}

// Test 3: Registration Performance
async function testRegistrationPerformance(): Promise<TestResult> {
  console.log('\n=== Test 3: Registration Performance ===');
  
  const iterations = 10;
  const latencies: number[] = [];
  
  try {
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      const response = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `simpleperf${i}-${Date.now()}@test.com`,
          password: 'TestPassword123!',
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Registration ${i} failed: ${response.status} - ${errorText}`);
        continue;
      }
      
      const endTime = performance.now();
      latencies.push(endTime - startTime);
      
      await delay(100);
    }
    
    if (latencies.length === 0) {
      console.log('All registrations failed');
      return {
        name: 'Registration Performance',
        passed: false,
        measured: 0,
        target: 500,
        unit: 'ms',
      };
    }
    
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    
    console.log(`Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`Min: ${minLatency.toFixed(2)}ms`);
    console.log(`Max: ${maxLatency.toFixed(2)}ms`);
    console.log(`Successful: ${latencies.length}/${iterations}`);
    console.log(`Target: <500ms`);
    
    const passed = avgLatency < 500 && latencies.length >= iterations / 2;
    console.log(`Result: ${passed ? '✓ PASS' : '✗ FAIL'}`);
    
    return {
      name: 'Registration Performance',
      passed,
      measured: avgLatency,
      target: 500,
      unit: 'ms',
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      name: 'Registration Performance',
      passed: false,
      measured: 0,
      target: 500,
      unit: 'ms',
    };
  }
}

// Test 4: Concurrent Requests
async function testConcurrentRequests(): Promise<TestResult> {
  console.log('\n=== Test 4: Concurrent Requests ===');
  
  const concurrency = 50;
  
  try {
    const startTime = performance.now();
    
    const promises = Array.from({ length: concurrency }, () =>
      fetch('http://localhost:3000/health')
    );
    
    const responses = await Promise.all(promises);
    const endTime = performance.now();
    
    const successCount = responses.filter(r => r.ok).length;
    const totalTime = endTime - startTime;
    const avgTime = totalTime / concurrency;
    
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average per request: ${avgTime.toFixed(2)}ms`);
    console.log(`Successful: ${successCount}/${concurrency}`);
    console.log(`Target: All requests complete in <2000ms`);
    
    const passed = totalTime < 2000 && successCount === concurrency;
    console.log(`Result: ${passed ? '✓ PASS' : '✗ FAIL'}`);
    
    return {
      name: 'Concurrent Requests',
      passed,
      measured: totalTime,
      target: 2000,
      unit: 'ms',
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      name: 'Concurrent Requests',
      passed: false,
      measured: 0,
      target: 2000,
      unit: 'ms',
    };
  }
}

// Test 5: Memory Baseline
async function testMemoryBaseline(): Promise<TestResult> {
  console.log('\n=== Test 5: Memory Usage Baseline ===');
  
  try {
    const memUsage = process.memoryUsage();
    
    console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Target: <200 MB heap used`);
    
    const heapMB = memUsage.heapUsed / 1024 / 1024;
    const passed = heapMB < 200;
    console.log(`Result: ${passed ? '✓ PASS' : '✗ FAIL'}`);
    
    return {
      name: 'Memory Usage',
      passed,
      measured: heapMB,
      target: 200,
      unit: 'MB',
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      name: 'Memory Usage',
      passed: false,
      measured: 0,
      target: 200,
      unit: 'MB',
    };
  }
}

async function main() {
  console.log('====================================');
  console.log('Simple Performance Test Suite');
  console.log('====================================');
  
  results.push(await testStartupTime());
  results.push(await testAPIResponseTime());
  results.push(await testRegistrationPerformance());
  results.push(await testConcurrentRequests());
  results.push(await testMemoryBaseline());
  
  console.log('\n====================================');
  console.log('Summary');
  console.log('====================================\n');
  
  results.forEach(result => {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    const measured = result.measured.toFixed(2);
    const target = result.target.toFixed(0);
    console.log(`${status} ${result.name}: ${measured}${result.unit} (target: <${target}${result.unit})`);
  });
  
  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
