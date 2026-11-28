const fs = require('node:fs');
const path = require('node:path');

const GAME_LOG_FILE_NAME = 'Game.log';
const CHANNELS = ['LIVE', 'PTU', 'TECH-PREVIEW', 'EPTU'];
const INSTALL_ROOTS = [
  ['Program Files', 'Roberts Space Industries', 'StarCitizen'],
  ['Roberts Space Industries', 'StarCitizen'],
  ['Games', 'Roberts Space Industries', 'StarCitizen'],
  ['StarCitizen'],
];

function hasGameLog(folder) {
  try {
    return fs.statSync(path.join(folder, GAME_LOG_FILE_NAME)).isFile();
  } catch {
    return false;
  }
}

function listDriveRoots() {
  const roots = [];
  for (let code = 'C'.charCodeAt(0); code <= 'Z'.charCodeAt(0); code += 1) {
    const root = `${String.fromCharCode(code)}:\\`;
    if (fs.existsSync(root)) {
      roots.push(root);
    }
  }
  return roots;
}

function findGameFolders() {
  const found = [];
  for (const driveRoot of listDriveRoots()) {
    for (const parts of INSTALL_ROOTS) {
      for (const channel of CHANNELS) {
        const folder = path.join(driveRoot, ...parts, channel);
        if (hasGameLog(folder)) {
          found.push(folder);
        }
      }
    }
  }
  return found.sort((left, right) => {
    const leftTime = fs.statSync(path.join(left, GAME_LOG_FILE_NAME)).mtimeMs;
    const rightTime = fs.statSync(path.join(right, GAME_LOG_FILE_NAME)).mtimeMs;
    return rightTime - leftTime;
  });
}

module.exports = { GAME_LOG_FILE_NAME, findGameFolders, hasGameLog };
