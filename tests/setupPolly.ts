import { Polly } from '@pollyjs/core';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';

// Register the adapters and persisters
Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

// Global Polly configuration
export function setupPolly(recordingName: string) {
  return new Polly(recordingName, {
    adapters: ['node-http'],
    persister: 'fs',
    persisterOptions: {
      fs: {
        recordingsDir: './polly/fixtures'
      }
    },
    recordIfMissing: process.env.VCR_MODE === 'record',
    matchRequestsBy: {
      method: true,
      headers: false, // Ignore headers to avoid auth token issues
      body: true,
      order: false,
      url: {
        protocol: true,
        username: false,
        password: false,
        hostname: true,
        port: true,
        pathname: true,
        query: true,
        hash: false
      }
    }
  });
}