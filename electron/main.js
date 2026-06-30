const { app, BrowserWindow, shell, ipcMain, dialog, clipboard, nativeImage } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')
const isDev = !app.isPackaged

// ── Logging ──────────────────────────────────────────────────────────────────
autoUpdater.logger = require('electron').app
  ? (() => { try { return require('electron-log') } catch { return console } })()
  : console
autoUpdater.autoDownload = false        // Hỏi user trước khi tải
autoUpdater.autoInstallOnAppQuit = true // Tự cài khi đóng app

let mainWin = null

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Bảng Giá T&T',
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f3',
  })

  if (isDev) {
    mainWin.loadURL('http://localhost:5173')
    mainWin.webContents.openDevTools()
  } else {
    mainWin.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── Clipboard / lưu ảnh (dev + production) ───────────────────────────────────
function setupClipboardIpc() {
  ipcMain.handle('clipboard-copy-image', (_e, dataUrl) => {
    try {
      const img = nativeImage.createFromDataURL(dataUrl)
      if (img.isEmpty()) return { ok: false }
      clipboard.writeImage(img)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('clipboard-save-image', async (_e, dataUrl, defaultName) => {
    try {
      const img = nativeImage.createFromDataURL(dataUrl)
      if (img.isEmpty()) return { ok: false }
      const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
        title: 'Lưu ảnh',
        defaultPath: defaultName || 'san-pham.png',
        filters: [
          { name: 'PNG', extensions: ['png'] },
          { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
        ],
      })
      if (canceled || !filePath) return { ok: false, canceled: true }
      const ext = path.extname(filePath).toLowerCase()
      const buf = ext === '.jpg' || ext === '.jpeg' ? img.toJPEG(92) : img.toPNG()
      fs.writeFileSync(filePath, buf)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })
}

// ── Auto-update events ────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return // Không check update khi dev

  autoUpdater.on('checking-for-update', () => {
    mainWin?.webContents.send('update-status', { type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWin?.webContents.send('update-status', {
      type: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes || '',
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWin?.webContents.send('update-status', { type: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWin?.webContents.send('update-status', {
      type: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWin?.webContents.send('update-status', { type: 'downloaded' })
  })

  autoUpdater.on('error', (err) => {
    mainWin?.webContents.send('update-status', { type: 'error', message: err.message })
  })

  // IPC: renderer yêu cầu tải update
  ipcMain.on('update-download', () => {
    autoUpdater.downloadUpdate()
  })

  // IPC: renderer yêu cầu cài và restart
  ipcMain.on('update-install', () => {
    autoUpdater.quitAndInstall()
  })

  // IPC: renderer hỏi check thủ công
  ipcMain.on('update-check', () => {
    autoUpdater.checkForUpdates().catch(() => {})
  })

  // Check tự động sau 3s khi app mở
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 3000)
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  setupClipboardIpc()
  createWindow()
  setupAutoUpdater()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
