/**
 * Global browser prevention module (CommonJS format for --require)
 * 
 * This module patches all browser opening mechanisms to prevent
 * actual browser launching during tests, even in child processes.
 */

console.log('[NO-BROWSER] Browser prevention patch loaded');

// Simple approach: Patch child_process.spawn to intercept browser commands
const cp = require('child_process');
const originalSpawn = cp.spawn;

cp.spawn = function(command, args, options) {
  // Detect browser-opening commands across platforms
  if (command === 'open' || command === 'xdg-open' || command === 'start' || 
      (args && args.length > 0 && (args[0] === 'open' || args[0] === 'xdg-open'))) {
    console.log('[NO-BROWSER] Blocked browser command:', command, args);
    
    // Return a fake process object that behaves like a successful process
    const EventEmitter = require('events');
    const fakeProcess = new EventEmitter();
    fakeProcess.stdout = new EventEmitter();
    fakeProcess.stderr = new EventEmitter();
    fakeProcess.stdin = { write: () => {}, end: () => {} };
    fakeProcess.pid = Math.floor(Math.random() * 10000);
    fakeProcess.kill = () => {};
    fakeProcess.unref = () => {};
    
    // Emit success after a short delay to simulate process completion
    process.nextTick(() => {
      fakeProcess.emit('close', 0);
      fakeProcess.emit('exit', 0);
    });
    
    return fakeProcess;
  }
  
  return originalSpawn.apply(this, arguments);
};

console.log('[NO-BROWSER] Browser prevention patch applied to child_process.spawn');