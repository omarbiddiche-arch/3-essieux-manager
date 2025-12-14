const fs = require('fs');

let content = fs.readFileSync('c:/Users/Utilisateur/.gemini/antigravity/playground/ionic-horizon/app.js', 'utf8');

// Replace all broken emoji characters with simple text
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

fs.writeFileSync('c:/Users/Utilisateur/.gemini/antigravity/playground/ionic-horizon/app.js', content, 'utf8');
console.log('✅ Cleaned!');
