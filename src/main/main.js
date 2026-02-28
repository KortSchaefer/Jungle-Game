const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs/promises");

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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
  }
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
