const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  // Only notarize on Mac OS
  if (context.electronPlatformName !== 'darwin') {
    console.log('Skipping notarization - not macOS');
    return;
  }

  // Skip if notarization is disabled via environment variable
  if (process.env.DISABLE_NOTARIZATION === 'true') {
    console.log('Skipping notarization - disabled by environment variable');
    return;
  }

  console.log('Starting notarization process with notarytool');
  
  const appBundleId = context.packager.appInfo.info._configuration.appId;
  const appName = context.packager.appInfo.name;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appBundleId} at ${appPath}`);

  try {
    // Use the new notarytool-based approach
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
    console.log('Notarization complete');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};