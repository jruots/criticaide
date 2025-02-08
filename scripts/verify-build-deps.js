const fs = require('fs');
const path = require('path');

// Only check for VC++ Redistributable on Windows
if (process.platform === 'win32') {
    const vcRedistPath = path.join(__dirname, '..', 'build', 'VC_redist.x64.exe');
    if (!fs.existsSync(vcRedistPath)) {
        console.error('\x1b[31mError: VC_redist.x64.exe not found in build folder!\x1b[0m');
        console.error(`Expected path: ${vcRedistPath}`);
        process.exit(1);
    }
    console.log('\x1b[32mVC++ Redistributable verified!\x1b[0m');
} else {
    console.log('\x1b[32mSkipping VC++ Redistributable check on non-Windows platform\x1b[0m');
}