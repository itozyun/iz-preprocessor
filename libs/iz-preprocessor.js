// if the module has no dependencies, the above pattern can be simplified to
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof exports === 'object') {
        // commonjs
        module.exports = factory();
    } else {
        // Browser globals
        root[ 'izPreprocessor' ] = factory;
    }
})(this, function () {

function createClass( Constructor, members, classMembers ){
    var k;

    for( k in members ) Constructor.prototype[ k ] = members[ k ];
    for( k in classMembers ) Constructor[ k ] = classMembers[ k ];

    Constructor.inherits = inheritClass;

    return Constructor;
};

function inheritClass( Constructor, members, classMembers ){
    var superClass = this;

    Constructor.prototype.__proto__ = superClass.prototype;
    Constructor.prototype.Super     = function(){ return superClass.apply( this, arguments ) };
    return createClass( Constructor, members, classMembers );
};

/*--------------------------------------------------
 * Error
 */
function RangeError( msg, lineAt, range ){
    this.message = msg || '';
    this.lineAt  = lineAt || 0;
    this.range   = range || '';
}

/*--------------------------------------------------
 * ItemBase
 */
var Base = createClass(
    function( tag, title, summary ){
        this.tag = tag || '';
        if( title ) this.title = title;
        if( summary ) this.summary = summary;
    },
    {
        type    : 0,
        tag     : '',
        title   : '',
        summary : '',

        update : function( title, summary ){
            if( !this.title ) this.title = title;
            if( !this.summary ) this.summary = summary;
        }
    }
);

/*--------------------------------------------------
 * Target < ItemBase
 */
var Target = Base.inherits(
    function( tag, title, summary ){
        this.Super( tag, title, summary );
    },
    {
        type : 1,

        isTarget : function(){ return this === Target.current; },

        toString : function(){
            return '@' + this.tag;
        }
    },
    {
        LIST    : [],
        current : null,
        create  : function( tag, title, summary ){
            var i = 0, l = Target.LIST.length, tgt;

            for( ; i < l; ++i ){
                tgt = Target.LIST[ i ];
                if( tgt.tag === tag ){
                    tgt.update( title, summary );
                    return tgt;
                };
            };
            tgt = new Target( tag, title, summary );
            Target.LIST.push( tgt );
            return tgt;
        }
    }
);

/*--------------------------------------------------
 * Group < ItemBase
 */
var Group = Base.inherits(
    function( tag, title, summary, targetsAndGroups ){
        var i, l, member, sym;

        this.Super( tag, title, summary );
        this.members = [];

        if( targetsAndGroups ){
            for( i = 0, l = targetsAndGroups.length; i < l; ++i ){
                tag = targetsAndGroups[ i ];
                sym = tag.charAt( 0 );
                tag = tag.substr( 1 );
                switch( sym ){
                    case '@' :
                        member = Target.create( tag );
                        break;
                    case '#' :
                        member = Group.create( tag ); // TODO 循環参照のチェック
                        break;
                    default :
                        continue;
                };
                this.members.indexOf( member ) === -1 && this.members.push( member );
            };
        };
    },
    {
        type    : 2,
        members : null, // array.<Group|Target>

        isTarget : function(){
            for( var i = 0, l = this.members.length; i < l; ++i ){
                if( this.members[ i ].isTarget() ) return true;
            };
            return false;
        },

        toString : function(){
            return '[' + this.members.join( ',' ) + ']';
        }
    },
    {
        LIST   : [],
        create : function( tag, title, summary, depends ){
            var i = 0, l = Group.LIST.length, grp;

            for( ; i < l; ++i ){
                grp = Group.LIST[ i ];
                if( grp.tag === tag ){
                    grp.update( title, summary );
                    return grp;
                };
            };
            grp = new Group( tag, title, summary, depends );
            Group.LIST.push( grp );
            return grp;
        }
    }
);

/*--------------------------------------------------
 * Option < ItemBase
 */
var Option = Base.inherits(
    function( tag, title, summary, depends ){
        var i, l, tag, imp;

        this.Super( tag, title, summary );
        this.dependBy = [];

        if( depends ){
            for( i = 0, l = depends.length; i < l; ++i ){
                tag = depends[ i ];
                tag.charAt( 0 ) === '+' && ( tag = tag.substr( 1 ) );
                imp = Option.create( tag );
                imp.dependBy.indexOf( this ) === -1 && imp.dependBy.push( this );
            };
        };
    },
    {
        type      : 3,
        _imported : false,
        dependBy  : null, // array.<Option>

        /*
         * TODO 循環参照のチェック
         */
        isImported : function(){
            var i = 0, l = this.dependBy.length;

            if( this.tag === Option.DELETE ) return false;

            if( this._imported ) return true;

            for( ; i < l; ++i ){
                if( this.dependBy[ i ].isImported() ) return true;
            };

            return false;
        },

        toString : function(){
            return '#' + this.tag;
        }
    },
    {
        LIST   : [],
        DELETE : '-delete',
        create : function( tag, title, summary, depends ){
            var i = 0, l = Option.LIST.length, opt;

            for( ; i < l; ++i ){
                opt = Option.LIST[ i ];
                if( opt.tag === tag ){
                    opt.update( title, summary );
                    return opt;
                };
            };
            opt = new Option( tag, title, summary, depends );
            Option.LIST.push( opt );
            return opt;
        },
        imports : function( tag ){
            var opt = Option.create( tag );

            opt._imported = true;
            return opt;
        }
    }
);

/*--------------------------------------------------
 * Range
 */
var Range = createClass(
    function( tags, start, notFlags ){
        this.tags     = tags;
        this.start    = start;
        this.notFlags = notFlags;
    },
    {
        tags     : null, // array.<Target|Group|Option|ReplaceRange>
        notFlags : 0,
        start    : 0,
        end      : 0,
        parent   : null, // Range
        length   : 0,

        addChildRange : function( range ){
            this[ this.length ] = range;
            ++this.length;
            range.parent = this;
        },

        getTagNames : function(){
            if( this === Range.top ) return 'ROOT';
            return this.tags.join( ',' );
        },

        eq : function( tags ){
            var i = tags.length;

            if( !this.tags ) return false;
            if( tags.notFlags !== this.notFlags || this.tags.length !== i ) return false;

            for( ; i; ){
                if( this.tags.indexOf( tags[ --i ] ) === -1 ) return false;
            };
            return true;
        },
        
        getChildRangeAt : function( line ){
            var i = 0, l = this.length;

            for( ; i < l; ++i ){
                if( this[ i ].start <= line && line <= this[ i ].end ) return this[ i ];
            };
        },

        live : function(){
            var i = 0, l, tag, flag, parent = this;

            if( this === Range.top ) return true;

            // 親にOptionレンジがいないか？
            /*
            while( parent = parent.parent ){
                if( parent.tags ){
                    tag = parent.tags[ 0 ];
                    if( tag.type === 3 && tag.tag !== Option.DELETE && !parent.live() ) return false;
                };
            };*/

            for( l = this.tags.length ; i < l; ++i ){
                tag = this.tags[ i ];

                if( tag.type === 3 ){ // Option
                    flag = tag.isImported();
                } else { // Taget|Group
                    flag = tag.isTarget();
                };

                if( flag === !( this.notFlags & ( 1 << i ) ) ) return true;
            };

            return false;
        },

        toString : function(){
            return '_{' + this.getTagNames() + '}_';
        }
    },
    {
        LIST   : [],
        top    : null,
        create : function( tags, start, notFlags ){
            var rng = new Range( tags, start, notFlags );
            if( Range.LIST.length === 0 ){
                rng.end = Infinity;
                Range.top = rng;
            };
            Range.LIST.push( rng );
            return rng;
        }
    }
);

/*--------------------------------------------------
 * ReplaceRange < Range
 */
var ReplaceRange = Range.inherits(
    function( start, dir, depth ){
        this.start = start;
        this.dir   = dir;
        this.depth = depth;
        if( ReplaceRange.maxDepth < this.depth ) ReplaceRange.maxDepth = this.depth;
    },
    {
        dir   : '',
        depth : 0,
        getTagNames : function(){
            return this.dir + this.depth;
        },
        addChildRange : function( range ){
            Range.prototype.addChildRange.call( this, range );

            // 親に ReplaceRange がいないか？確認
        },
        eq       : function(){ return false; },
        live     : function(){ return this.parent.live(); },
        toString : function(){
            return '<' + this.getTagNames() + '>';
        }
    },
    {
        LIST     : [],
        maxDepth : 0,

        create : function( start, dir, depth ){
            var rng = new ReplaceRange( start, dir, depth );
            ReplaceRange.LIST.push( rng );
            return rng;
        }
    }
);

/*--------------------------------------------------
 * Collector 文字列内の拡張コメントを元に Range ツリーを作る
 */
    function collectTags( textLines ){
        var numLines  = textLines.length,
            line      = 0,
            topRange  = Range.create( null, 0, 0 ),
            last      = topRange,
            sourceText, pos, def, txt, dir, depth, obj;

        for( ; line < numLines; ++line ){
            sourceText = textLines[ line ];
            // 条件付コメントを収集
            pos = minWithoutMinus(
                    sourceText.indexOf( '//@' ),
                    sourceText.indexOf( '//#' ),
                    sourceText.indexOf( '//+' ),
                    sourceText.indexOf( '//!' ),
                    sourceText.indexOf( '//_' ) );

            if( pos === -1 ) continue;

            def   = sourceText.substr( pos, 3 );
            def   = def === '//_' ? sourceText.substr( pos, 4 ) : def;

            txt   = sourceText.substring( pos + def.length );
            txt   = txt.split( ' ' )[ 0 ];

            dir   = txt.substr( 0, 3 ) === 'top' ? 'top' : 'bottom';
            depth = parseFloat( txt.substr( dir === 'top' ? 3 : 6 ) ) | 0;
            depth = 0 < depth ? ( depth < 100 ? depth : 100 ) : 0;

            switch( def ){
                // アイテム定義
                case '//@' :
                case '//#' :
                case '//+' :
                case '//!' :
                    parseConditionName( sourceText.substring( pos + 2 ), line, pos );
                    break;

                // Range定義・開始
                case '//_{' :
                    last = parseConditionName( txt, line, pos, last );
                    if( !last ){
                        // error
                        console.log( 'Range definition error. line at', line );
                        throw new RangeError( 'Range definition error.', line, sourceText );
                    };
                    break;

                // Range定義・終端
                case '//_}' :
                    obj = parseConditionName( txt, line, pos );
                    if( !last.eq( obj ) ){
                        // error
                        console.log( 'Mismatch at the end of Range.', line, ' 現在のRange=', ' start=', last.start );
                        throw new RangeError( 'Mismatch at the end of Range.', line, last.toString() );
                    };
                    last.end = line;
                    last = last.parent || null;
                    break;

                // 移動レンジ・開始
                case '//_<' :
                    obj  = ReplaceRange.create( line, dir, depth );
                    last.addChildRange( obj );
                    last = obj;
                    break;

                // 移動レンジ・終端
                case '//_>' :
                    if( last.constructor !== ReplaceRange ){
                        // error
                        console.log( 'Mismatch at the end of Range.line at ', line );
                        throw new RangeError( 'Mismatch at the end of Range.', line, last.toString() );
                    };
                    if( last.dir !== dir || last.depth !== depth ){
                        // error
                        console.log( 'Mismatch at the end of Range. line at ', line );
                        throw new RangeError( 'Mismatch at the end of Range.', line, last.toString() );
                    };
                    last.end = line;
                    last = last.parent || null;
                    break;
            };
        };

        if( last !== topRange ){
            console.log( 'No termination of Range. line at ', last.start, textLines[ last.start ] );
            throw new RangeError( 'No termination of Range.', last.start, last.toString() );
        } else {
            return last;
        };
    };

    // 最小の数、負の数は除く
    function minWithoutMinus(){
        var l = arguments.length,
            min = 1 / 0, n;
        for( ; l; ){
            n = arguments[ --l ];
            if( 0 <= n && n < min ) min = n;
        };
        return min === 1 / 0 ? -1 : min;
    };
    
    function parseConditionName( str, line, start, rangeParent ){
        var original = str, notFlags = 0,
            i, z, depends, summary, ary, title, tags, tag, sym, depth, obj;
    
        i = str.indexOf( '[' );//依存関係
        z = str.indexOf( ']', i );
        if( i !== -1 && z !== -1 ){
            depends = str.substring( i + 1, z ).split( ',' );
            str = str.substr( 0, i );
        };

        // コメント
        i = str.indexOf( '(' );
        z = str.indexOf( ')', i );
        if( i !== -1 && z !== -1 ){
            summary = str.substring( i + 1, z );
            str  = str.substr( 0, i );
        };
        // 名前
        if( ( ary = str.split( '"' ) ).length === 3 ){
            title = ary[ 1 ];
            str   = ary[ 0 ];
        };

        tags = str.split( ',' );

        for( i = 0, z = tags.length; i < z; ++i ){
            tag = tags[ i ];
            sym = tag.charAt( 0 );
            tag = tag.substr( 1 );
            if( sym === '^' ){ // not
                sym = tag.charAt( 0 );
                tag = tag.substr( 1 );
                notFlags += ( 1 << i );
            };
            switch( sym ){
                case '@' : // ターゲット環境
                    obj = Target.create( tag, title, summary );
                    break;
                case '#' : // グルーピングラベル
                    obj = Group.create( tag, title, summary, depends );
                    break;
                case '+' : // オプション
                    obj = Option.create( tag, title, summary, depends );
                    break;
                case '!' : // インポートの指示
                    Option.imports( tag );
                    break;
                case '' : // delete
                    obj = Option.create( Option.DELETE );
                    break;
                default :
                    console.log( tag.charAt( 0 ), ':', tag.charCodeAt( 0 ) );
                    console.log( original + '\n' + title + '\n' + summary + '\n' + depends );
            };
            tags[ i ] = obj;
        };

        if( rangeParent && obj ){
            obj = Range.create( tags, line, notFlags );
            rangeParent.addChildRange( obj );
            return obj;
        };
        if( obj ){
            tags.notFlags = notFlags;
            return tags;
        };
    };

/*--------------------------------------------------
 * Target.current 現在のビルドターゲットに応じたテキストの切り出し
 */
    function buildText( textLines ){
        var rTop = Range.top,
            rCrt = rTop,
            i = 0, l = textLines.length,
            moveToTops = [], moveToBottoms = [],
            temp = [ 0, 0 ], j, k, m;

        for( ; i < l; ++i ){
            if( rCrt.end < i ) rCrt = rCrt.parent;
            // TODO rCrt.type === RmRange || rCrt.live()
            if( rCrt.live()  ) rCrt = rCrt.getChildRangeAt( i ) || rCrt;
            if( !rCrt.live() ) textLines[ i ] = '';

            if( rCrt.dir === 'top'    && moveToTops.indexOf( rCrt )    === -1 ) moveToTops.push( rCrt );
            if( rCrt.dir === 'bottom' && moveToBottoms.indexOf( rCrt ) === -1 ) moveToBottoms.push( rCrt );
        };

        if( rCrt.end < i ) rCrt = rCrt.parent;

        if( rCrt !== rTop ) return;

        // ReplaceRange
        for( i = moveToTops.length; rCrt = moveToTops[ --i ]; ){
            for( k = rCrt.start, m = rCrt.end; k <= m; ++k ){
                temp.push( textLines[ k ] );
                textLines[ k ] = '';
            };
        };

        for( j = 0, l = ReplaceRange.maxDepth; j <= l; ++j ){
            for( i = -1; rCrt = moveToBottoms[ ++i ]; ){
                if( j === rCrt.depth ){
                    for( k = rCrt.start, m = rCrt.end; k <= m; ++k ){
                        textLines.push( textLines[ k ] );
                        textLines[ k ] = '';
                    };
                };
            };
        };

        textLines.splice.apply( textLines, temp );

        // cleanup
        i = 0;
        while( i < textLines.length ){
            if( textLines[ i ] === '' ){
                textLines.splice( i, 1 );
            } else {
                ++i;
            };
        };

        return textLines;
    };

return {
    collectExComments : function( textLines, enabledOptions ){
        console.log( 'iz-preprosessor start! ---' );

        Target.LIST.length = Group.LIST.length = Option.LIST.length =
        ReplaceRange.LIST.length = Range.LIST.length = 0;

        var range = collectTags( textLines ),
            i, l, item, targets = [],
            ary1, ary2;

        if( enabledOptions && enabledOptions.push ){
            for( i = 0, l = enabledOptions.length; i < l; ++i ){
                Option.imports( enabledOptions[ i ] );
                console.log( enabledOptions[ i ] );
            };
        };

         if( range ){
            console.log('@ target : ', Target.LIST.length );
            console.log('# group  : ', Group.LIST.length );
            console.log('+ option : ', Option.LIST.length );
            for( i = 0, l = Option.LIST.length, ary1 = [], ary2 = []; i < l; ++i ){
                item = Option.LIST[ i ];
                item.isImported() ? ary1.push( item.tag ) : ary2.push( item.tag );
            };
            console.log( '.. enabled  options : ', ary1.join( ',' ) );
            console.log( '.. disabled options : ', ary2.join( ',' ) );

            console.log('Range         :', Range.LIST.length - 1 );
            console.log('Replace range :', ReplaceRange.LIST.length );

            for( i = 1, ary3 = []; i < Range.LIST.length; ++i ){
                item = Range.LIST[ i ];
                //console.log( item.start + '-' + item.end );
            };
            //console.log( ary3.join( ',' ) );

            for( i = 0, l = Target.LIST.length; i < l; ++i ){
                targets[ i ] = Target.LIST[ i ].tag;
            };

            return targets;
         };
    },

    preCompile : function( textLines, target ){
        var i = 0, l = Target.LIST.length, ary = [];

        for( ; i < l; ++i ){
            if( target === Target.LIST[ i ].tag ){
                Target.current = Target.LIST[ i ];
                for( i = 0, l = textLines.length; i < l; ++i ) ary[ i ] = textLines[ i ];
                return buildText( ary );
            };
        };
    }
};
});