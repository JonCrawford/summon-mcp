#!/usr/bin/env node

import { startMockTokenBroker } from '../src/mock-token-broker.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const port = process.env.MOCK_BROKER_PORT || 3000;
const server = startMockTokenBroker(port);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down mock token broker...');
  server.close(() => {
    console.log('Mock token broker stopped.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});