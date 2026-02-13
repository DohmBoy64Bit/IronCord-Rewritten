/**
 * Multi-User Integration Test
 * 
 * Tests concurrent operations with multiple users to verify:
 * - Data consistency across concurrent requests
 * - No race conditions in database operations
 * - Proper transaction isolation
 * - Error handling under load
 */

import { DatabaseService } from '@ironcord/db';
import { UserRepository } from '../../packages/db/src/repositories/user.repository.js';
import { GuildRepository } from '../../packages/db/src/repositories/guild.repository.js';
import { ChannelRepository } from '../../packages/db/src/repositories/channel.repository.js';
import { MemberRepository } from '../../packages/db/src/repositories/member.repository.js';

interface TestUser {
  id: string;
  email: string;
  password: string;
  irc_nick: string;
}

interface TestGuild {
  id: string;
  name: string;
  owner_id: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestUsers(userRepo: UserRepository, count: number): Promise<TestUser[]> {
  const users: TestUser[] = [];
  
  console.log(`Creating ${count} test users...`);
  
  for (let i = 0; i < count; i++) {
    const email = `multiuser${i}@test.com`;
    const password = 'TestPassword123!';
    const irc_nick = `multiuser${i}`;
    
    try {
      const user = await userRepo.create({
        email,
        password_hash: password, // In real scenario this would be hashed
        irc_nick,
      });
      
      users.push({
        id: user.id,
        email,
        password,
        irc_nick,
      });
    } catch (error) {
      console.error(`Failed to create user ${i}:`, error);
    }
  }
  
  console.log(`Created ${users.length} users successfully`);
  return users;
}

async function testConcurrentGuildCreation(guildRepo: GuildRepository, users: TestUser[]): Promise<boolean> {
  console.log('\n=== Testing Concurrent Guild Creation ===');
  
  const promises = users.map(async (user, index) => {
    const guildName = `Guild ${index}`;
    const namespace = `guild-${index}-${Date.now()}`;
    
    try {
      const guild = await guildRepo.create({
        name: guildName,
        owner_id: user.id,
        irc_namespace_prefix: namespace,
      });
      
      return { success: true, guild };
    } catch (error) {
      console.error(`Failed to create guild for user ${user.irc_nick}:`, error);
      return { success: false, error };
    }
  });
  
  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.success).length;
  
  console.log(`Successfully created ${successCount}/${users.length} guilds concurrently`);
  return successCount === users.length;
}

async function testConcurrentChannelCreation(guildRepo: GuildRepository, channelRepo: ChannelRepository, users: TestUser[]): Promise<boolean> {
  console.log('\n=== Testing Concurrent Channel Creation ===');
  
  // First create a guild for each user
  const guilds: TestGuild[] = [];
  for (const user of users) {
    const guild = await guildRepo.create({
      name: `Test Guild ${user.irc_nick}`,
      owner_id: user.id,
      irc_namespace_prefix: `test-${user.irc_nick}-${Date.now()}`,
    });
    guilds.push(guild);
  }
  
  // Now create multiple channels concurrently
  const promises = guilds.flatMap((guild, guildIndex) => 
    Array.from({ length: 5 }, (_, channelIndex) => {
      const channelName = `channel-${channelIndex}`;
      const ircChannelName = `#${guild.irc_namespace_prefix}-${channelName}`;
      
      return channelRepo.create({
        guild_id: guild.id,
        name: channelName,
        irc_channel_name: ircChannelName,
      });
    })
  );
  
  try {
    const results = await Promise.all(promises);
    console.log(`Successfully created ${results.length} channels concurrently`);
    return true;
  } catch (error) {
    console.error('Failed to create channels concurrently:', error);
    return false;
  }
}

async function testConcurrentMemberOperations(guildRepo: GuildRepository, memberRepo: MemberRepository, users: TestUser[]): Promise<boolean> {
  console.log('\n=== Testing Concurrent Member Operations ===');
  
  // Create one guild owned by first user
  const owner = users[0];
  const guild = await guildRepo.create({
    name: 'Shared Guild',
    owner_id: owner.id,
    irc_namespace_prefix: `shared-${Date.now()}`,
  });
  
  // Add all users as members concurrently
  const promises = users.map(user => 
    memberRepo.add({ guild_id: guild.id, user_id: user.id })
  );
  
  try {
    await Promise.all(promises);
    
    // Verify all members were added
    const members = await memberRepo.findByGuildId(guild.id);
    console.log(`Successfully added ${members.length}/${users.length} members concurrently`);
    
    return members.length === users.length;
  } catch (error) {
    console.error('Failed concurrent member operations:', error);
    return false;
  }
}

async function testDataConsistency(db: DatabaseService, userRepo: UserRepository, guildRepo: GuildRepository, users: TestUser[]): Promise<boolean> {
  console.log('\n=== Testing Data Consistency ===');
  
  let consistent = true;
  
  // Test 1: Verify all users exist
  for (const user of users) {
    const dbUser = await userRepo.findById(user.id);
    if (!dbUser) {
      console.error(`User ${user.id} not found in database`);
      consistent = false;
    }
  }
  
  // Test 2: Verify foreign key relationships
  const guilds = await db.query('SELECT * FROM guilds');
  for (const guild of guilds.rows) {
    if (guild.owner_id) {
      const owner = await userRepo.findById(guild.owner_id);
      if (!owner) {
        console.error(`Guild ${guild.id} has invalid owner_id ${guild.owner_id}`);
        consistent = false;
      }
    }
  }
  
  // Test 3: Verify no orphaned records
  const channels = await db.query('SELECT * FROM channels');
  for (const channel of channels.rows) {
    const guild = await guildRepo.findById(channel.guild_id);
    if (!guild) {
      console.error(`Channel ${channel.id} has invalid guild_id ${channel.guild_id}`);
      consistent = false;
    }
  }
  
  if (consistent) {
    console.log('All data consistency checks passed ✓');
  } else {
    console.error('Data consistency issues detected ✗');
  }
  
  return consistent;
}

async function cleanupTestData(db: DatabaseService): Promise<void> {
  console.log('\n=== Cleaning Up Test Data ===');
  
  await db.query("DELETE FROM channels WHERE guild_id IN (SELECT id FROM guilds WHERE irc_namespace_prefix LIKE 'guild-%' OR irc_namespace_prefix LIKE 'test-%' OR irc_namespace_prefix LIKE 'shared-%')");
  await db.query("DELETE FROM guild_members WHERE guild_id IN (SELECT id FROM guilds WHERE irc_namespace_prefix LIKE 'guild-%' OR irc_namespace_prefix LIKE 'test-%' OR irc_namespace_prefix LIKE 'shared-%')");
  await db.query("DELETE FROM guilds WHERE irc_namespace_prefix LIKE 'guild-%' OR irc_namespace_prefix LIKE 'test-%' OR irc_namespace_prefix LIKE 'shared-%'");
  await db.query("DELETE FROM users WHERE email LIKE 'multiuser%@test.com'");
  
  console.log('Test data cleaned up successfully');
}

async function main() {
  console.log('====================================');
  console.log('Multi-User Integration Test Suite');
  console.log('====================================\n');
  
  const db = new DatabaseService({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    database: process.env.DB_NAME || 'ironcord_test',
    user: process.env.DB_USER || 'ironcord_test',
    password: process.env.DB_PASSWORD || 'ironcord_test_password',
  });
  
  try {
    await db.connect();
    await db.initializeSchema();
    
    // Initialize repositories
    const userRepo = new UserRepository(db);
    const guildRepo = new GuildRepository(db);
    const channelRepo = new ChannelRepository(db);
    const memberRepo = new MemberRepository(db);
    
    // Clean up any previous test data
    await cleanupTestData(db);
    
    // Create test users
    const userCount = 10;
    const users = await createTestUsers(userRepo, userCount);
    
    if (users.length < userCount) {
      console.error(`Failed to create all test users. Aborting.`);
      process.exit(1);
    }
    
    // Run concurrent tests
    const results = {
      guildCreation: await testConcurrentGuildCreation(guildRepo, users),
      channelCreation: await testConcurrentChannelCreation(guildRepo, channelRepo, users),
      memberOperations: await testConcurrentMemberOperations(guildRepo, memberRepo, users),
      dataConsistency: await testDataConsistency(db, userRepo, guildRepo, users),
    };
    
    // Clean up
    await cleanupTestData(db);
    
    // Report results
    console.log('\n====================================');
    console.log('Test Results Summary');
    console.log('====================================');
    console.log(`Guild Creation:     ${results.guildCreation ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Channel Creation:   ${results.channelCreation ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Member Operations:  ${results.memberOperations ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Data Consistency:   ${results.dataConsistency ? '✓ PASS' : '✗ FAIL'}`);
    
    const allPassed = Object.values(results).every(r => r === true);
    console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('Test suite failed with error:', error);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

main().catch(console.error);
