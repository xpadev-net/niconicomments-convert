const builder = require('electron-builder');

builder.build({
    config: {
        'appId': 'net.xpadev.niconicomments-convert',
        'icon': 'assets/niconicomments_icon.png',
        'mac': {
            'target': 'zip',
        }
    }
});