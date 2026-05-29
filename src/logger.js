function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function debug(...args) {
  if (process.env.DEBUG === '1') {
    console.log(`[${new Date().toISOString()}] [DEBUG]`, ...args);
  }
}

module.exports = { log, debug };