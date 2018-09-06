// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "iz preprocessor" is now active!');

    var vscode   = require('vscode'),
        compiler = require('./libs/iz-preprocessor'),
        izFS     = require('./libs/izFS'),
        com      = vscode.commands.registerCommand('extension.izPreprocessor',
// settings.json  
//  {
//    "izPreprocessor.tasks" : {
//      "scss" : [
//        {
//          "path"    : "scss/inline.scss",
//          "output"  : "./precompiled/scss1"
//         },
//         {
//           "find"    : { rootPath:[ "", "", "" ], include:"scss**.scss", exclude:"" },
//           "output"  : "./precompiled/scss2"
//         }
//       ],
//       "js"  : [
//         {
//           "find"    : { rootPath:"./src", include:"js**.js", exclude:"" },
//           "output"  : "./precompiled/js",
//           "imports" : [ "dev", "mobile", "legacybrowser" ],
//           "prefix"  : "dev-"
//         },
//         {
//           "constitution" : [ ";(function(){", { path : [ "first.js", "last.js" ] }, "})();" ],
//           ...
//         }
//       ]
//    }
//  }
    function(){
        var ws     = vscode.workspace,
            fs     = new izFS( ws.rootPath ),
            config = ws.getConfiguration('izPreprocessor'),
            tasks, targetTextLines, srcFilesMap,
            targetFileType, outpotFolderPath, importOptions, prefix,
            buildTargets, total, progress;

        if( !ws.rootPath ){
            vscode.window.showErrorMessage('(T-T) Use of mainFile requires a folder to be opened');
            return;
        };

        if( !config.tasks ){
            vscode.window.showErrorMessage('(T-T) izPreprocessor.tasks not found');
            return;   
        };

        try {
            tasks = JSON.parse(JSON.stringify(config.tasks)); // deep copy
            total = tasks.length;
        } catch(o_O){
            vscode.window.showErrorMessage( '(T-T) ' + o_O );
            return;
        };

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

                    targetFileType   = key;
                    outpotFolderPath = task.output;
                    importOptions    = task.imports || [];
                    prefix           = task.prefix  || '';

                    if( task.find ){
                        fs.find({
                            rootPath : task.find.rootPath,
                            include  : task.find.include,
                            exclude  : task.find.exclude,
                            getText  : true
                            }, findFileDispatcher );
                    } else if( task.path ){
                        fs.read({
                            path     : task.path,
                            getText  : true
                            }, readFileDispatcher );
                    } else {
                        vscode.window.showErrorMessage('(T-T) Task for [' + key + '] has no "find" or "path" prperty.');
                    };
                    return;
                } else {
                    delete tasks[ key ];
                };
            };

            vscode.window.setStatusBarMessage( 'complete!' );
        };

        function findFileDispatcher( ite ){
            switch( ite.type ){
                case 'findFileSuccess' :
                    saveTextLines( ite );
                    ite.next();
                    break;
                case 'findFileError' :
                    vscode.window.showErrorMessage( '(T-T) ' + ite.error );
                    ite.kill();
                    break;
                case 'findFileComplete' :
                    collectExComments();
                    break;
            };
        };

        function readFileDispatcher( ite ){
            switch( ite.type ){
                 case 'readFileSuccess' :
                    saveTextLines( ite );
                    collectExComments();
                    break;
                case 'readFileError' :
                    vscode.window.showErrorMessage( '(T-T) ' + ite.error );
                    break;
            };
        };

        function collectExComments(){
            var info;

            try {
                buildTargets = compiler.collectExComments( targetTextLines, importOptions );
            } catch(o_O){
                info = globalLineNumberToLocal( o_O.lineAt );
                // console.log( o_O.message + '\nfile:' + info.name + ' line at ' + info.lineAt + '. range:' + o_O.range );
                vscode.window.showErrorMessage( o_O.message + '\nfile:' + info.name + ' line at ' + info.lineAt + '. range:' + o_O.range );
                return;
            }
            createFile();

            function globalLineNumberToLocal( line ){
                var file, _line;
    
                for( file in srcFilesMap ){
                    _line = line;
                    line -= srcFilesMap[ file ];
                    if( line <= 0 ) break;
                };
                return { name : file, lineAt : _line + 1 };
            };
        }

        function saveTextLines( ite ){
            var textLines = ite.data.split( '\r' ).join( '' ).split( '\n' );

            srcFilesMap[ ite.path ] = textLines.length;
            targetTextLines.push.apply( targetTextLines, textLines );
        };

        function createFile(){
            var buildTarget = buildTargets.shift(),
                texts;

            if( buildTarget ){
                vscode.window.setStatusBarMessage( '[' + targetFileType + ']' + ( ++progress ) + '/' + total + ':[' + buildTarget + ']' );
                texts = compiler.preCompile( targetTextLines, buildTarget );
                fs.write(
                    createPath( outpotFolderPath, prefix + buildTarget + '.' + targetFileType ),
                    texts.join( '\n' )
                        .split( String.fromCharCode( 65279 ) ).join( '' ), // Remove BOM
                    writeFileDispatcher
                );
            } else {
                vscode.window.setStatusBarMessage( '[' + targetFileType + ']' + ( ++progress ) + '/' + total + ':** done! **' );
                start();
            };
        };

        function writeFileDispatcher( e ){
            switch( e.type ){
                case 'writeFileSuccess' :
                    createFile();
                    break;
                case 'writeFileError' :
                    vscode.window.showErrorMessage( '(T-T) ' + e.error );
                    break;
            };
        };

        function createPath( a, b ){
            if( a.charAt( a.length - 1 ) === '/' ) a = a.substr( 0, a.length - 1 );
            if( b.charAt( 0 ) === '/' ) b = b.substr( 1 );
            return a + '/' + b;
        };
    });

    context.subscriptions.push( com );
};
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;