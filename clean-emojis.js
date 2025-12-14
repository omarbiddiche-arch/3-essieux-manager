const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');

if (!fs.existsSync(appJsPath)) {
    console.error('Error: app.js not found at', appJsPath);
    process.exit(1);
}

let content = fs.readFileSync(appJsPath, 'utf8');

// Replace all broken emoji characters with simple text
// WARNING: This regex removes all non-ASCII characters, including French accents (é, è, à, etc.)
// Use with caution!
content = content.replace(/[^\x00-\x7F]/g, function (char) {
    // Keep only ASCII characters, replace others with space or remove
    return '';
});

// Now add back the buttons with simple text
content = content.replace(/class="btn btn-sm btn-secondary">[^<]*<\/a>/g, 'class="btn btn-sm btn-secondary">Voir</a>');
content = content.replace(/class="btn btn-sm btn-danger"[^>]*>[^<]*<\/button>/g, function (match) {
    if (match.includes('deleteDocument')) {
        return match.replace(/>.*<\/button>/, '>Suppr</button>');
    }
    return match;
});

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('✅ Cleaned!');
