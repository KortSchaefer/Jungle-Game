const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { autoUpdater } = require("electron-updater");

function getSlotFilePath(slotId) {
  const safeSlot = Number(slotId);
  if (!Number.isInteger(safeSlot) || safeSlot < 1 || safeSlot > 3) {
    throw new Error("Invalid slot id");
  }

  return path.join(app.getPath("userData"), "saves", `slot-${safeSlot}.json`);
}

async function ensureSaveDir() {
  const dir = path.join(app.getPath("userData"), "saves");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function registerSaveIpcHandlers() {
  ipcMain.handle("save:write-slot-file", async (_event, payload) => {
    const { slotId, jsonString } = payload || {};
    const filePath = getSlotFilePath(slotId);
    await ensureSaveDir();
    await fs.writeFile(filePath, String(jsonString || ""), "utf8");
    return { ok: true, filePath };
  });

  ipcMain.handle("save:read-slot-file", async (_event, payload) => {
    const { slotId } = payload || {};
    const filePath = getSlotFilePath(slotId);

    try {
      const jsonString = await fs.readFile(filePath, "utf8");
      return { ok: true, jsonString, filePath };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { ok: true, jsonString: null, filePath };
      }

      throw error;
    }
  });
}

function initAutoUpdater(mainWindow) {
  const isDev = !app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL);
  if (isDev) {
    return;
  }

  if (process.platform === "win32" && process.argv.includes("--squirrel-firstrun")) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("[updater] error", error?.message || error);
  });

  autoUpdater.on("update-available", (info) => {
    console.log(`[updater] update available: ${info?.version || "unknown"}`);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[updater] no updates available");
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update Ready",
      message: `Version ${info?.version || "new"} has been downloaded.`,
      detail: "Restart now to apply the update.",
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error("[updater] check failed", error?.message || error);
    });
  }, 3500);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Launch in full-screen windowed mode (maximized, not exclusive fullscreen).
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
  }

  initAutoUpdater(mainWindow);
}

app.whenReady().then(() => {
  registerSaveIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
