# iz preprocessor

## Overview

1. Build for each targets
2. Optional build
3. Move code blocks for optimized build.

---

## 1. Build for each targets
### src.js
1. Wrap if-block by remove range( `//_{` ~ `//_}` ).
2. Then define target ranges( `//_{@XX` ~ `//_}@XX` ). 

~~~js
//_{
if(UA.PC){
    //_{@PC
        console.log('I am PC.');
    //_}@PC
} else if(UA.iOS){
    //_{@iOS
        console.log('I am iOS.');
    //_}@iOS
} else {
    //_{@Android
        console.log('I am Android.');
    //_}@Android
};
//_}
~~~

You will get those 3 files.

### PC.js
~~~js
//_{@PC
    console.log('I am PC.');
//_}@PC
~~~

### iOS.js
~~~js
//_{@iOS
    console.log('I am iOS.');
//_}@iOS
~~~

### Android.js
~~~js
//_{@Android
    console.log('I am Android.');
//_}@Android
~~~

## 2. Optional build

### Define option at library.js.
~~~js
//_{+ajax
    console.log('Implementation of Ajax.');
//_}+ajax
~~~

### Import option at main.js.
~~~js
//!ajax

function main(){
    console.log('I can call Ajax!');
};
~~~

## 3. Move code blocks for optimized build.

### Move to top
Collecting to the top for optimized build.
For example, Collect each @enum definitions for [Closure Compiler](https://developers.google.com/closure/compiler/).  

~~~js
//_<top
    /**
    * @enum {number}
    */
    project.TriState = {
        TRUE  : 1,
        FALSE : -1,
        MAYBE : 0
    };
//_>top
~~~

### Move to bottom
Collecting to the bottom for optimized build.
For example, Collect each @media blocks for [Clean CSS](https://github.com/jakubpawlowicz/clean-css).  

~~~css
h1 { background : #000; }

/* //_<bottom99 */
        @media print {h1 { background : #fff; }}
/* //_>bottom99 */

h1 { color : red; }

/* //_<bottom50 */
        @media handheld, only screen and (max-width: 479px) {h1 { color : green; }}
/* //_>bottom50 */

/* //_<bottom99 */
        @media print {h1 { color : #000; }}
/* //_>bottom99 */
~~~

~~~css
h1 { background : #000; }
h1 { color : red; }

/* //_<bottom50 */
        @media handheld, only screen and (max-width: 479px) {h1 { color : green; }}
/* //_>bottom50 */

/* //_<bottom99 */
        @media print {h1 { background : #fff; }}
/* //_>bottom99 */
/* //_<bottom99 */
        @media print {h1 { color : #000; }}
/* //_>bottom99 */
~~~

---

## Extended comments
### dfn
| ex. commnet                | name                             | desc                     |
|:---------------------------|:---------------------------------|:-------------------------|
| `//@PC`                    | dfn build target                 |                          |
| `//#mobile[@iOS,#WinMobi]` | dfn group                        | //#xx[<@xx/#xx>, ...]    |
| `//+XHR`                   | dfn build option                 |                          |
| `//+ajax[+XHR,+MSXML]`     | dfn build option with dependenｔ | //+xx[+xx, ...]          |
| `//!ajax`                  | dfn import                       |                          |

### range
| ex. commnet                | name                             | desc                     |
|:---------------------------|:---------------------------------|:-------------------------|
| `//_{`                     | remove range                     | remove                   |
| `//_{@PC`                  | target range                     | keep if @PC              |
| `//_{#mobile`              | group  range                     | keep if #mobile          |
| `//_{@PC,#mobile`          | multi targets range              | //_{<@xx/#xx>, ...       |
| `//_{+ajax`                | option range                     | keep if "+ajax" imported |
| `//_{^@iOS`                | not range                        | keep without @iOS        |
| `//_<top`                  | move to top range                | move to top for optimized builds |
| `//_<bottom50`             | move to bottom range             | `//_<bottom(Order:0~100)` move to bottom for optimized builds |

## settings.json example
From version 0.0.4, the file path is now two ways, "path" and "find".
From version 0.0.2, add build parameters to settings.json.

~~~json
{
    "izPreprocessor.tasks" : {
        "scss" : [
                    {
                        "path"   : "scss/mobile.scss",
                        "output" : "precompiled_2/scss"
                    },
                    {
                        "find"   : {
                            "rootPath" : "source",
                            "include"  : "scss/**/*.scss",
                            "exclude"  : "node_modules"
                        },
                        "output" : "precompiled/scss"
                    }
                ],
        "js" : [
                    {
                        "path"   : "js/main.js",
                        "output" : "precompiled/js"
                    }
                ]
    }
}
~~~

## Projects in use

1. [web-doc-base](https://github.com/itozyun/web-doc-base) "Super project for itozyun's Web document projects"
2. [blogger-base](https://github.com/itozyun/blogger-base) "Common project for Blogger templete"
3. [OutCloud](http://outcloud.blogspot.com/) "itozyun's blog"

**Enjoy!**