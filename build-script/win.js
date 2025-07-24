const builder = require('electron-builder');

builder.build({
    config: {
        'appId': 'net.xpadev.niconicomments-convert',
        'icon': 'assets/niconicomments_icon.png',
        'win': {
            'target': {
                'target': 'zip',
                'arch': [
                    'x64',
                    //'ia32',
                ]
            }
        }
    },
    publish: "never"
});