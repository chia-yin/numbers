import { execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const IMAGE = 'gonghao-test';
const CONTAINER = 'gonghao-test-run';

function dockerAvailable() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function cleanup() {
  try {
    execSync(`docker stop ${CONTAINER}`, { stdio: 'ignore' });
  } catch {
    // container may not exist
  }
  try {
    execSync(`docker rm ${CONTAINER}`, { stdio: 'ignore' });
  } catch {
    // container may not exist
  }
}

test('docker image serves HTTP 200 on /', { skip: !dockerAvailable() }, async () => {
  cleanup();

  const hostPort = await getFreePort();
  const url = `http://localhost:${hostPort}/`;

  try {
    execSync(`docker build -t ${IMAGE} .`, { stdio: 'inherit' });
    execSync(
      `docker run -d -p ${hostPort}:3000 --name ${CONTAINER} ${IMAGE}`,
      { stdio: 'inherit' },
    );

    await sleep(5000);

    const response = await fetch(url);
    assert.strictEqual(response.status, 200);
  } finally {
    cleanup();
  }
});
