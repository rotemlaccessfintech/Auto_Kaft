const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Handle the 'execute-command' request from the renderer process
  ipcMain.handle("execute-command", async (event, env) => {
    const command = `kaft env ${env}`;
    console.log(`[Main Process] Executing command: ${command}`); // Log for debugging

    return new Promise((resolve) => {
      // Add a timeout for safety
      exec(
        command,
        { timeout: 60000, shell: true },
        (error, stdout, stderr) => {
          // 60 second timeout for env command
          if (error) {
            console.error(
              `[Main Process] Error executing command ${command}: ${error.message}`
            );
            // Send back an object indicating failure and the error message
            resolve({ success: false, error: error.message, stderr: stderr });
          } else {
            console.log(`[Main Process] Command ${command} successful. Output:
${stdout}`);
            // Send back an object indicating success and include the stdout
            resolve({ success: true, output: stdout, stderr: stderr }); // Ensure output is included
          }
        }
      );
    });
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
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
