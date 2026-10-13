const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile } = require('child_process');
const path = require('path');

function netsh(args) {
  return new Promise((resolve) => {
    execFile('netsh', args, { windowsHide: true, encoding: 'utf8' }, (_err, out) =>
      resolve(out || '')
    );
  });
}

function valueOf(output, label) {
  for (const line of output.split(/\r?\n/)) {
    if (line.includes(label) && line.includes(':')) {
      return line.slice(line.indexOf(':') + 1).trim();
    }
  }
  return '';
}

async function getNetworks() {
  const list = await netsh(['wlan', 'show', 'profiles']);
  const names = list
    .split(/\r?\n/)
    .filter((l) => l.includes('All User Profile') && l.includes(':'))
    .map((l) => l.slice(l.indexOf(':') + 1).trim());

  return Promise.all(
    names.map(async (name) => {
      const detail = await netsh(['wlan', 'show', 'profile', `name=${name}`, 'key=clear']);
      return {
        name,
        password: valueOf(detail, 'Key Content'),
        security: valueOf(detail, 'Authentication'),
      };
    })
  );
}

ipcMain.handle('wifi:list', getNetworks);

function createWindow() {
  const win = new BrowserWindow({
    width: 760,
    height: 620,
    minWidth: 520,
    backgroundColor: '#0f1117',
    title: 'WiFi Vault',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
