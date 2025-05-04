const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const Tray = electron.Tray;
const Menu = electron.Menu;

const path = require("path");
const { exec } = require("child_process");

let mainWindow = null;
let tray = null;

const iconPath = path.join(__dirname, '../assets/icon.png');

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the React development server URL.
  const targetURL = "http://localhost:5173";
  const maxRetries = 10;
  let retries = 0;

  const loadUrlWithRetry = () => {
    console.log(
      `[Main Process] Attempting to load URL: ${targetURL} (Attempt ${
        retries + 1
      }/${maxRetries})`
    );
    mainWindow
      .loadURL(targetURL)
      .then(() => {
        console.log(`[Main Process] Successfully loaded URL: ${targetURL}`);
      })
      .catch((err) => {
        console.error(
          `[Main Process] Failed to load URL (Attempt ${
            retries + 1
          }/${maxRetries}):`,
          err
        );
        retries++;
        if (retries < maxRetries) {
          // Wait 2 seconds before retrying
          setTimeout(loadUrlWithRetry, 2000);
        } else {
          console.error(
            `[Main Process] Max retries reached. Failed to load URL: ${targetURL}`
          );
          // Optionally, show an error message to the user or quit
        }
      });
  };

  // Start the loading process after a short initial delay (e.g., 3 seconds)
  setTimeout(loadUrlWithRetry, 3000);

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
    console.log('[Main Process] Window minimized to tray.');
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      console.log('[Main Process] Window closed to tray.');
    }
  });

  mainWindow.on('closed', () => {
    console.log('[Main Process] Main window closed event (might not happen if always hiding).');
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  try {
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          console.log('[Tray] Show App clicked.');
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            console.log('[Tray] Window not found, attempting to recreate.');
            createWindow();
          }
        }
      },
      {
        label: 'Quit',
        click: () => {
          console.log('[Tray] Quit clicked.');
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Auto Kaft');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      console.log('[Tray] Tray icon clicked.');
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    console.log('[Main Process] Tray icon created successfully.');

  } catch (error) {
    console.error('[Main Process] Failed to create tray icon:', error);
    console.error(`[Main Process] Ensure an icon exists at: ${iconPath}`);
  }

  app.on("activate", function () {
    if (mainWindow === null) {
      createWindow();
    } else if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.handle("execute-command", async (event, env) => {
    const command = `kaft env ${env}`;
    console.log(`[Main Process] Executing command: ${command}`);

    return new Promise((resolve) => {
      exec(
        command,
        { timeout: 60000, shell: true },
        (error, stdout, stderr) => {
          if (error) {
            console.error(
              `[Main Process] Error executing command ${command}: ${error.message}`
            );
            resolve({ success: false, error: error.message, stderr: stderr });
          } else {
            console.log(`[Main Process] Command ${command} successful. Output:
${stdout}`);
            resolve({ success: true, output: stdout, stderr: stderr });
          }
        }
      );
    });
  });

  // --- ADD IPC HANDLER FOR TOOLTIP START ---
  ipcMain.handle("update-tooltip", (event, tooltipText) => {
    if (tray && !tray.isDestroyed()) {
      console.log(`[Main Process] Updating tooltip to: "${tooltipText}"`);
      tray.setToolTip(tooltipText);
      return { success: true }; // Acknowledge the update
    } else {
      console.warn("[Main Process] Tray not available or destroyed, cannot update tooltip.");
      return { success: false, error: "Tray not available" };
    }
  });
  // --- ADD IPC HANDLER FOR TOOLTIP END ---
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    console.log('[App] window-all-closed event triggered. App continues running in tray.');
  }
});

app.on('before-quit', () => {
  console.log('[App] before-quit event: Cleaning up tray...');
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
});

// In this file, you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
// --- We will move the backend logic here later ---

// --- Backend Logic Integration ---

// Handle the 'check-status' request from the renderer process
ipcMain.handle("check-status", async (event) => {
  const command = `kaft status`;
  console.log(`[Main Process] Executing generic status check: ${command}`);

  return new Promise((resolve) => {
    exec(command, { timeout: 7000, shell: true }, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `[Main Process] Generic status check command failed: ${error.message}`
        );
        resolve({ success: false, error: error.message, stderr: stderr });
      } else {
        console.log(
          `[Main Process] Generic status check successful. Outputting stdout.`
        );
        resolve({ success: true, output: stdout });
      }
    });
  });
});
