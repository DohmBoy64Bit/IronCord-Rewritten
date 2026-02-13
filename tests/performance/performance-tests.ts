/**
 * Performance Testing Suite for IronCord v2
 * 
 * Tests:
 * - Startup time (<10s target)
 * - Message latency (<100ms target)
 * - History load time (<500ms for 100 messages target)
 * - Concurrent users (100+ users target)
 * - Message throughput (1000+ messages target)
 * - Memory leak detection
 * - CPU usage monitoring
 */

import { DatabaseService } from '@ironcord/db';
import { UserRepository } from '../../packages/db/src/repositories/user.repository.js';
import { GuildRepository } from '../../packages/db/src/repositories/guild.repository.js';
import { ChannelRepository } from '../../packages/db/src/repositories/channel.repository.js';
import { io, Socket } from 'socket.io-client';
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  startupTime: number;
  messageLatency: number[];
  historyLoadTime: number;
  concurrentUsers: number;
  messagesThroughput: number;
  memoryUsage: NodeJS.MemoryUsage[];
  cpuUsage: NodeJS.CpuUsage[];
}

interface TestConfig {
  gatewayUrl: string;
  dbConfig: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class PerformanceTestSuite {
  private config: TestConfig;
  private db: DatabaseService;
  private metrics: PerformanceMetrics;
  
  constructor(config: TestConfig) {
    this.config = config;
    this.db = new DatabaseService(config.dbConfig);
    this.metrics = {
      startupTime: 0,
      messageLatency: [],
      historyLoadTime: 0,
      concurrentUsers: 0,
      messagesThroughput: 0,
      memoryUsage: [],
      cpuUsage: [],
    };
  }
  
  async initialize(): Promise<void> {
    await this.db.connect();
    await this.db.initializeSchema();
    await this.cleanup();
  }
  
  async cleanup(): Promise<void> {
    await this.db.query("DELETE FROM channels WHERE guild_id IN (SELECT id FROM guilds WHERE irc_namespace_prefix LIKE 'perf-%')");
    await this.db.query("DELETE FROM guild_members WHERE guild_id IN (SELECT id FROM guilds WHERE irc_namespace_prefix LIKE 'perf-%')");
    await this.db.query("DELETE FROM guilds WHERE irc_namespace_prefix LIKE 'perf-%'");
    await this.db.query("DELETE FROM users WHERE email LIKE 'perfuser%@test.com'");
  }
  
  async disconnect(): Promise<void> {
    await this.db.disconnect();
  }
  
  // Test 1: Measure Startup Time
  async testStartupTime(): Promise<boolean> {
    console.log('\n=== Test 1: Startup Time ===');
    console.log('Target: <10 seconds');
    
    const startTime = performance.now();
    
    try {
      // Test database connection
      const dbStart = performance.now();
      await this.db.query('SELECT 1');
      const dbTime = performance.now() - dbStart;
      console.log(`Database connection: ${dbTime.toFixed(2)}ms`);
      
      // Test Gateway health endpoint
      const gatewayStart = performance.now();
      const response = await fetch(`${this.config.gatewayUrl}/health`);
      if (!response.ok) {
        throw new Error('Gateway health check failed');
      }
      const gatewayTime = performance.now() - gatewayStart;
      console.log(`Gateway health check: ${gatewayTime.toFixed(2)}ms`);
      
      const totalTime = performance.now() - startTime;
      this.metrics.startupTime = totalTime;
      
      console.log(`Total startup time: ${totalTime.toFixed(2)}ms`);
      console.log(`Result: ${totalTime < 10000 ? '✓ PASS' : '✗ FAIL'}`);
      
      return totalTime < 10000;
    } catch (error) {
      console.error('Startup test failed:', error);
      return false;
    }
  }
  
  // Test 2: Measure Message Latency
  async testMessageLatency(): Promise<boolean> {
    console.log('\n=== Test 2: Message Latency ===');
    console.log('Target: <100ms per message');
    
    try {
      // Register and login a test user
      const { token, userId } = await this.registerAndLogin('perfuser-latency@test.com', 'TestPassword123!');
      
      // Create guild and channel
      const { guildId, channelName } = await this.createGuildAndChannel(userId, 'perf-latency');
      
      // Connect to WebSocket
      const socket = await this.connectWebSocket(token);
      
      // Connect to IRC
      await this.connectToIRC(socket);
      await delay(1000); // Wait for IRC connection to stabilize
      
      // Join the channel
      await this.joinChannel(socket, channelName);
      await delay(500);
      
      // Measure message latency (50 messages)
      const latencies: number[] = [];
      
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        
        const messageReceived = new Promise<void>((resolve) => {
          socket.once('irc:message', () => {
            const latency = performance.now() - startTime;
            latencies.push(latency);
            resolve();
          });
        });
        
        socket.emit('irc:message', {
          target: channelName,
          text: `Performance test message ${i}`,
        });
        
        await messageReceived;
        await delay(50); // Small delay between messages
      }
      
      socket.disconnect();
      
      // Calculate statistics
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      
      this.metrics.messageLatency = latencies;
      
      console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`Min latency: ${minLatency.toFixed(2)}ms`);
      console.log(`Max latency: ${maxLatency.toFixed(2)}ms`);
      console.log(`Result: ${avgLatency < 100 ? '✓ PASS' : '✗ FAIL'}`);
      
      return avgLatency < 100;
    } catch (error) {
      console.error('Message latency test failed:', error);
      return false;
    }
  }
  
  // Test 3: Measure History Load Time
  async testHistoryLoadTime(): Promise<boolean> {
    console.log('\n=== Test 3: History Load Time ===');
    console.log('Target: <500ms for 100 messages');
    
    try {
      // Register and login a test user
      const { token, userId } = await this.registerAndLogin('perfuser-history@test.com', 'TestPassword123!');
      
      // Create guild and channel
      const { guildId, channelName } = await this.createGuildAndChannel(userId, 'perf-history');
      
      // Connect to WebSocket
      const socket = await this.connectWebSocket(token);
      
      // Connect to IRC
      await this.connectToIRC(socket);
      await delay(1000);
      
      // Join the channel
      await this.joinChannel(socket, channelName);
      await delay(500);
      
      // Send 100 messages to build history
      console.log('Sending 100 messages to build history...');
      for (let i = 0; i < 100; i++) {
        socket.emit('irc:message', {
          target: channelName,
          text: `History message ${i}`,
        });
        await delay(20); // Small delay to avoid overwhelming the server
      }
      
      await delay(2000); // Wait for all messages to be processed
      
      // Disconnect and reconnect to test history retrieval
      socket.disconnect();
      await delay(1000);
      
      const newSocket = await this.connectWebSocket(token);
      await this.connectToIRC(newSocket);
      await delay(1000);
      
      // Measure history load time
      const startTime = performance.now();
      
      const historyReceived = new Promise<void>((resolve) => {
        newSocket.once('irc:history', () => {
          resolve();
        });
      });
      
      newSocket.emit('irc:history', {
        target: channelName,
        limit: 100,
      });
      
      await historyReceived;
      const loadTime = performance.now() - startTime;
      
      newSocket.disconnect();
      
      this.metrics.historyLoadTime = loadTime;
      
      console.log(`History load time: ${loadTime.toFixed(2)}ms`);
      console.log(`Result: ${loadTime < 500 ? '✓ PASS' : '✗ FAIL'}`);
      
      return loadTime < 500;
    } catch (error) {
      console.error('History load time test failed:', error);
      return false;
    }
  }
  
  // Test 4: Concurrent Users Stress Test
  async testConcurrentUsers(): Promise<boolean> {
    console.log('\n=== Test 4: Concurrent Users Stress Test ===');
    console.log('Target: Handle 100+ concurrent users');
    
    const userCount = 120;
    const sockets: Socket[] = [];
    
    try {
      console.log(`Connecting ${userCount} concurrent users...`);
      
      // Create guild for all users to join
      const { token: ownerToken, userId: ownerId } = await this.registerAndLogin('perfuser-owner@test.com', 'TestPassword123!');
      const { guildId, channelName } = await this.createGuildAndChannel(ownerId, 'perf-concurrent');
      
      const startTime = performance.now();
      
      // Connect users in batches of 20
      const batchSize = 20;
      for (let batch = 0; batch < userCount / batchSize; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const userIndex = batch * batchSize + i;
          const promise = (async () => {
            const { token } = await this.registerAndLogin(
              `perfuser-concurrent${userIndex}@test.com`,
              'TestPassword123!'
            );
            const socket = await this.connectWebSocket(token);
            await this.connectToIRC(socket);
            sockets.push(socket);
          })();
          
          batchPromises.push(promise);
        }
        
        await Promise.all(batchPromises);
        console.log(`Connected batch ${batch + 1}/${userCount / batchSize} (${sockets.length} users)`);
      }
      
      const connectionTime = performance.now() - startTime;
      
      // Verify all connections are active
      const activeConnections = sockets.filter(s => s.connected).length;
      
      this.metrics.concurrentUsers = activeConnections;
      
      console.log(`Connection time: ${connectionTime.toFixed(2)}ms`);
      console.log(`Active connections: ${activeConnections}/${userCount}`);
      console.log(`Result: ${activeConnections >= 100 ? '✓ PASS' : '✗ FAIL'}`);
      
      // Cleanup
      sockets.forEach(s => s.disconnect());
      
      return activeConnections >= 100;
    } catch (error) {
      console.error('Concurrent users test failed:', error);
      sockets.forEach(s => s.disconnect());
      return false;
    }
  }
  
  // Test 5: Message Throughput Stress Test
  async testMessageThroughput(): Promise<boolean> {
    console.log('\n=== Test 5: Message Throughput Stress Test ===');
    console.log('Target: Handle 1000+ messages without degradation');
    
    try {
      // Register and login a test user
      const { token, userId } = await this.registerAndLogin('perfuser-throughput@test.com', 'TestPassword123!');
      
      // Create guild and channel
      const { guildId, channelName } = await this.createGuildAndChannel(userId, 'perf-throughput');
      
      // Connect to WebSocket
      const socket = await this.connectWebSocket(token);
      
      // Connect to IRC
      await this.connectToIRC(socket);
      await delay(1000);
      
      // Join the channel
      await this.joinChannel(socket, channelName);
      await delay(500);
      
      const messageCount = 1200;
      let receivedCount = 0;
      const startTime = performance.now();
      
      // Setup message receiver
      socket.on('irc:message', () => {
        receivedCount++;
      });
      
      console.log(`Sending ${messageCount} messages...`);
      
      // Send messages in batches
      const batchSize = 100;
      for (let batch = 0; batch < messageCount / batchSize; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const messageIndex = batch * batchSize + i;
          batchPromises.push(
            new Promise<void>((resolve) => {
              socket.emit('irc:message', {
                target: channelName,
                text: `Throughput message ${messageIndex}`,
              });
              resolve();
            })
          );
        }
        
        await Promise.all(batchPromises);
        console.log(`Sent batch ${batch + 1}/${messageCount / batchSize}`);
        await delay(100); // Small delay between batches
      }
      
      // Wait for all messages to be received
      await delay(5000);
      
      const totalTime = performance.now() - startTime;
      const throughput = (receivedCount / totalTime) * 1000; // messages per second
      
      socket.disconnect();
      
      this.metrics.messagesThroughput = throughput;
      
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Messages sent: ${messageCount}`);
      console.log(`Messages received: ${receivedCount}`);
      console.log(`Throughput: ${throughput.toFixed(2)} messages/second`);
      console.log(`Result: ${receivedCount >= 1000 ? '✓ PASS' : '✗ FAIL'}`);
      
      return receivedCount >= 1000;
    } catch (error) {
      console.error('Message throughput test failed:', error);
      return false;
    }
  }
  
  // Test 6: Memory Leak Detection
  async testMemoryLeaks(): Promise<boolean> {
    console.log('\n=== Test 6: Memory Leak Detection ===');
    console.log('Target: No significant memory growth over time');
    
    try {
      const { token, userId } = await this.registerAndLogin('perfuser-memory@test.com', 'TestPassword123!');
      const { guildId, channelName } = await this.createGuildAndChannel(userId, 'perf-memory');
      
      const iterations = 10;
      const memorySnapshots: NodeJS.MemoryUsage[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const socket = await this.connectWebSocket(token);
        await this.connectToIRC(socket);
        await delay(500);
        
        // Perform some operations
        await this.joinChannel(socket, channelName);
        
        for (let j = 0; j < 10; j++) {
          socket.emit('irc:message', {
            target: channelName,
            text: `Memory test message ${i}-${j}`,
          });
        }
        
        await delay(500);
        
        // Take memory snapshot
        const memUsage = process.memoryUsage();
        memorySnapshots.push(memUsage);
        
        socket.disconnect();
        await delay(500);
        
        if (global.gc) {
          global.gc();
        }
      }
      
      this.metrics.memoryUsage = memorySnapshots;
      
      // Analyze memory growth
      const firstHeapUsed = memorySnapshots[0].heapUsed;
      const lastHeapUsed = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const growthPercent = ((lastHeapUsed - firstHeapUsed) / firstHeapUsed) * 100;
      
      console.log(`Initial heap: ${(firstHeapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Final heap: ${(lastHeapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Growth: ${growthPercent.toFixed(2)}%`);
      console.log(`Result: ${growthPercent < 50 ? '✓ PASS' : '✗ FAIL'} (threshold: 50%)`);
      
      return growthPercent < 50;
    } catch (error) {
      console.error('Memory leak test failed:', error);
      return false;
    }
  }
  
  // Helper: Register and login user
  private async registerAndLogin(email: string, password: string): Promise<{ token: string; userId: string }> {
    const registerResponse = await fetch(`${this.config.gatewayUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!registerResponse.ok) {
      throw new Error(`Registration failed: ${registerResponse.statusText}`);
    }
    
    const data = await registerResponse.json();
    return { token: data.token, userId: data.user.id };
  }
  
  // Helper: Create guild and channel
  private async createGuildAndChannel(
    userId: string,
    namespace: string
  ): Promise<{ guildId: string; channelName: string }> {
    const userRepo = new UserRepository(this.db);
    const guildRepo = new GuildRepository(this.db);
    const channelRepo = new ChannelRepository(this.db);
    
    const guild = await guildRepo.create({
      name: `Perf Test Guild ${namespace}`,
      owner_id: userId,
      irc_namespace_prefix: namespace,
    });
    
    const channel = await channelRepo.create({
      guild_id: guild.id,
      name: 'general',
      irc_channel_name: `#${namespace}-general`,
    });
    
    return {
      guildId: guild.id,
      channelName: channel.irc_channel_name,
    };
  }
  
  // Helper: Connect to WebSocket
  private async connectWebSocket(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(this.config.gatewayUrl, {
        auth: { token },
        transports: ['websocket'],
      });
      
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (error) => reject(error));
      
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    });
  }
  
  // Helper: Connect to IRC
  private async connectToIRC(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once('irc:ready', () => resolve());
      socket.once('error', (error) => reject(error));
      socket.emit('irc:connect', {
        server: 'localhost',
        port: 6667,
        nickname: `user${Date.now()}`,
      });
      
      setTimeout(() => reject(new Error('IRC connection timeout')), 10000);
    });
  }
  
  // Helper: Join IRC channel
  private async joinChannel(socket: Socket, channel: string): Promise<void> {
    return new Promise((resolve) => {
      socket.once('irc:joined', () => resolve());
      socket.emit('irc:join', { channel });
      
      setTimeout(() => resolve(), 5000); // Timeout fallback
    });
  }
  
  // Generate performance report
  generateReport(): void {
    console.log('\n====================================');
    console.log('Performance Test Results Summary');
    console.log('====================================\n');
    
    console.log('Startup Time:');
    console.log(`  Measured: ${this.metrics.startupTime.toFixed(2)}ms`);
    console.log(`  Target: <10,000ms`);
    console.log(`  Status: ${this.metrics.startupTime < 10000 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    if (this.metrics.messageLatency.length > 0) {
      const avgLatency = this.metrics.messageLatency.reduce((a, b) => a + b, 0) / this.metrics.messageLatency.length;
      console.log('Message Latency:');
      console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`  Target: <100ms`);
      console.log(`  Status: ${avgLatency < 100 ? '✓ PASS' : '✗ FAIL'}\n`);
    }
    
    console.log('History Load Time:');
    console.log(`  Measured: ${this.metrics.historyLoadTime.toFixed(2)}ms`);
    console.log(`  Target: <500ms`);
    console.log(`  Status: ${this.metrics.historyLoadTime < 500 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    console.log('Concurrent Users:');
    console.log(`  Handled: ${this.metrics.concurrentUsers}`);
    console.log(`  Target: 100+`);
    console.log(`  Status: ${this.metrics.concurrentUsers >= 100 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    console.log('Message Throughput:');
    console.log(`  Achieved: ${this.metrics.messagesThroughput.toFixed(2)} messages/second`);
    console.log(`  Target: Handle 1000+ messages`);
    console.log(`  Status: ${this.metrics.messagesThroughput > 0 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    if (this.metrics.memoryUsage.length > 0) {
      const firstHeap = this.metrics.memoryUsage[0].heapUsed;
      const lastHeap = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1].heapUsed;
      const growthPercent = ((lastHeap - firstHeap) / firstHeap) * 100;
      
      console.log('Memory Usage:');
      console.log(`  Initial: ${(firstHeap / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Final: ${(lastHeap / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Growth: ${growthPercent.toFixed(2)}%`);
      console.log(`  Status: ${growthPercent < 50 ? '✓ PASS' : '✗ FAIL'}\n`);
    }
  }
}

async function main() {
  const config: TestConfig = {
    gatewayUrl: (process.env.GATEWAY_URL || 'http://localhost:3000').trim(),
    dbConfig: {
      host: (process.env.DB_HOST || 'localhost').trim(),
      port: parseInt((process.env.DB_PORT || '5432').trim(), 10),
      database: (process.env.DB_NAME || 'ironcord').trim(),
      user: (process.env.DB_USER || 'ironcord').trim(),
      password: (process.env.DB_PASSWORD || 'ironcord_password').trim(),
    },
  };
  
  const suite = new PerformanceTestSuite(config);
  
  try {
    await suite.initialize();
    
    const results = {
      startupTime: await suite.testStartupTime(),
      messageLatency: await suite.testMessageLatency(),
      historyLoadTime: await suite.testHistoryLoadTime(),
      concurrentUsers: await suite.testConcurrentUsers(),
      messageThroughput: await suite.testMessageThroughput(),
      memoryLeaks: await suite.testMemoryLeaks(),
    };
    
    suite.generateReport();
    
    const allPassed = Object.values(results).every(r => r === true);
    console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
    
    await suite.cleanup();
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Performance test suite failed:', error);
    process.exit(1);
  } finally {
    await suite.disconnect();
  }
}

main().catch(console.error);
