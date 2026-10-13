const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, encoding: 'utf8' }, (err, stdout) =>
      resolve({ ok: !err, out: stdout || '' })
    );
  });
}

// `net session` only succeeds when the process is elevated.
async function isAdmin() {
  return (await run('net', ['session'])).ok;
}

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1].trim()) : '';
}

// Language-independent: works on the exported XML, not on translated netsh text.
function classify(xml) {
  const auth = tag(xml, 'authentication');
  const enc = tag(xml, 'encryption');
  const key = tag(xml, 'keyMaterial');
  const protectedKey = tag(xml, 'protected').toLowerCase() === 'true';
  const enterprise = /<OneX\b|<EAPConfig|<useOneX>\s*true/i.test(xml);

  let status;
  let password = '';
  if (enterprise) {
    status = 'enterprise';
  } else if (auth.toLowerCase() === 'open' && enc.toLowerCase() === 'none') {
    status = 'open';
  } else if (key && !protectedKey) {
    status = 'ok';
    password = key;
  } else {
    status = 'unreadable';
  }

  const security = [auth, enc && enc.toLowerCase() !== 'none' ? enc : ''].filter(Boolean).join(' / ');
  return { status, password, security };
}

async function getNetworks() {
  const admin = await isAdmin();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wifivault-'));
  try {
    await run('netsh', ['wlan', 'export', 'profile', 'key=clear', `folder=${dir}`]);
    const files = (await fs.readdir(dir)).filter((f) => f.toLowerCase().endsWith('.xml'));
    const networks = [];
    for (const f of files) {
      const xml = await fs.readFile(path.join(dir, f), 'utf8');
      const name = tag(xml, 'name');
      if (name) networks.push({ name, ...classify(xml) });
    }
    networks.sort((a, b) => a.name.localeCompare(b.name));
    return { admin, networks };
  } finally {
    // The exported files contain plain-text passwords: always delete them.
    await fs.rm(dir, { recursive: true, force: true });
  }
}

ipcMain.handle('wifi:list', getNetworks);

function createWindow() {
  const win = new BrowserWindow({
    width: 780,
    height: 640,
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
