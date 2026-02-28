const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  appName: "Enterprise Software Electron",
  saveFileSupport: true,
  writeSlotFile: (slotId, jsonString) => ipcRenderer.invoke("save:write-slot-file", { slotId, jsonString }),
  readSlotFile: (slotId) => ipcRenderer.invoke("save:read-slot-file", { slotId }),
});
