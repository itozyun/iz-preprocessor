// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "iz preprocessor" is now active!');

    var MAX_TARGET_FILES = 100, // https://github.com/Microsoft/vscode/issues/697

        vscode   = require('vscode'),
        fs       = require('fs'),
        compiler = require('./lib/iz-preprocessor'),
        com      = vscode.commands.registerCommand('extension.izPreprocessor',
// settings.json  
//        {
//            "izPreprocessor.tasks" : {
//                "scss" : [
//                            {
//                                "include" : "scss/**/*.scss",
//                                "exclude" : "**/node_modules/**",
//                                "output"  : ""
//                            }
//                        ],
//                "js"   : [
//                            {
//                                "include" : "js/**/*.js",
//                                "exclude" : "**/node_modules/**",
//                                "output"  : ""
//                            }
//                        ]
//            }
//        }
    function(){
        var ws         = vscode.workspace,
            wsRootPath = ws.rootPath,
            config     = ws.getConfiguration('izPreprocessor'),
            tasks      = config && JSON.parse(JSON.stringify(config.tasks)), // deep copy
            targetTextLines, srcFilesMap, targetFileType, outpotFolderPath, targetFiles, buildTargets, buildTarget,
            total, progress;

        if( !wsRootPath ){
            vscode.window.showErrorMessage('Use of mainFile requires a folder to be opened');
            return;
        };

        if( !tasks ){
            vscode.window.showErrorMessage('(T-T) Not fonund "izPreprocessor.tasks" at settings.json.');
            return;
        };

        wsRootPath = wsRootPath + ( wsRootPath.substr( wsRootPath.length - 1 ) === '\\' ? '' : '\\' );
        ws.saveAll();
        start();

        function start(){
            var key, task;

            //targetTextLines.lengh = 0;
            targetTextLines = [];
            srcFilesMap     = {};

            for( key in tasks ){
                if( tasks[ key ] && tasks[ key ].length ){
                    task = tasks[ key ].shift();

                    targetFileType = key;
                    outpotFolderPath = wsRootPath + task.output;

                    ws.findFiles( task.include, task.exclude, MAX_TARGET_FILES ).then( onFilesFound );
                    return;
                } else {
                    delete tasks[ key ];
                };
            };

            vscode.window.setStatusBarMessage( 'complete!' );
        };

        function onFilesFound( files ){
            if( total = files.length ){
                files.sort();
                progress    = -1;
                targetFiles = files;
                readFilesThenCollectExComments();
            } else {
                vscode.window.setStatusBarMessage( 'fileType:' + targetFileType + ' was not found.' );
                start();
            };
        };
        
        function readFilesThenCollectExComments(){
            var targetFileUri = targetFiles.shift();
            
            if( targetFileUri ){
                vscode.window.setStatusBarMessage( '[' + targetFileType + ']' + ( ++progress ) + '/' + total + ':reading' );

                ws.openTextDocument( targetFileUri ).then( onFileOpened );
            } else {
               vscode.window.setStatusBarMessage( 'collectExComments' );

                if( buildTargets = compiler.collectExComments( targetTextLines ) ){
                    // http://stackoverflow.com/questions/13696148/node-js-create-folder-or-use-existing
                    // If you want a quick-and-dirty one liner, use this:
                    fs.existsSync( outpotFolderPath ) || fs.mkdirSync( outpotFolderPath );

                    total    = buildTargets.length;
                    progress = -1;
                    createFile();
                } else {
                    vscode.window.setStatusBarMessage( '[' + targetFileType + ']' + 'error at collectExComments' );
                };
            };
        };

        function onFileOpened(d){
            var textLines = d.getText().split( '\r' ).join( '' ).split( '\n' );

            srcFilesMap[ d.fileName ] = textLines.length;
            console.log( d.fileName, textLines.length );
            targetTextLines.push.apply( targetTextLines, textLines );
            readFilesThenCollectExComments();
        };

        function createFile(){
            buildTarget = buildTargets.shift();
            if( buildTarget ){
                vscode.window.setStatusBarMessage( '[' + targetFileType + ']' + ( ++progress ) + '/' + total + ':[' + buildTarget + ']' );
                fs.open( outpotFolderPath + '\\' + buildTarget + '.' + targetFileType, 'w', onFileCreated );
            } else {
                vscode.window.setStatusBarMessage( '[' + targetFileType + ']' + ( ++progress ) + '/' + total + ':** done! **' );
                start();
            };
        };

        function onFileCreated(err, fd){
            var textLines = compiler.preCompile( targetTextLines, buildTarget ),
                buffer;

            if( textLines && fd ){
                buffer = new Buffer( textLines.join( '\r\n' ) );
                fs.writeSync( fd, buffer, 0, buffer.length );
                fs.close(fd);
                createFile();
            } else {
                vscode.window.setStatusBarMessage( 'error at preCompile[' + buildTarget + ']' + err );
            };
        };

        function globalLineNumberToLocal( line ){
            var file, _line;

            for( file in srcFilesMap ){
                _line = line;
                line -= srcFilesMap[ file ];
                if( line < 0 ) break;
            };
            return { fileName : file, lineAt : _line };
        };
    });

    context.subscriptions.push( com );
};
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;