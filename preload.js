const { contextBridge, ipcRenderer } = require('electron');

// إنشاء جسر آمن ومحترف يربط واجهة الويب بنظام التشغيل عبر Electron
contextBridge.exposeInMainWorld('electronAPI', {
  // معلومات البيئة الأساسية
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },

  // نظام آمن لإرسال البيانات للعمليات الخلفية (Main Process)
  send: (channel, data) => {
    const validSendChannels = ['app-action', 'export-database'];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // نظام آمن لاستقبال البيانات من العمليات الخلفية
  receive: (channel, callback) => {
    const validReceiveChannels = ['app-response', 'database-status'];
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // منع تسريب أوامر النظام الخطيرة وتأمين النطاق بشكل كامل
  removeAllListeners: (channel) => {
    const validChannels = ['app-response', 'database-status'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});
