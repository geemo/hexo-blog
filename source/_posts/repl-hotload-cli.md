---
title: REPL模块热加载命令行工具
date: 2016-06-20 18:11:07
categories:
- 代码
tags:
- Node.js
---

使用方法:

**load(module_name)**

加载模块，module_name为模块名，
若module_name为**/aa/bb/cc-dd.js**,
需要用**ccDd(将-d替换成D)**对象调用其属性或方法。

用法如下:
```sh
> load('express');
undefined
> express.     //按tab
express.__defineGetter__      express.__defineSetter__
express.__lookupGetter__      express.__lookupSetter__
express.__proto__             express.constructor
express.hasOwnProperty        express.isPrototypeOf
express.propertyIsEnumerable  express.toLocaleString
express.toString              express.valueOf
...
```
<!--more-->
**reload(module_name)**

重新加载模块，该方法会清空模块缓存后重新加载模块，以达到热加载的目的。

用法如下:
```sh
> reload('express');
reload success, use time: 1ms
```

**clear(module_name)**

清除模块缓存。

用法如下:
```sh
> clear('express');
> express   //回车
ReferenceError: express is not defined          //因为express缓存被清空了
    at repl:1:1
    at REPLServer.defaultEval (repl.js:274:27)
    at bound (domain.js:280:14)
    at REPLServer.runBound [as eval] (domain.js:293:12)
    at REPLServer.<anonymous> (repl.js:441:10)
    at emitOne (events.js:96:13)
    at REPLServer.emit (events.js:188:7)
    at REPLServer.Interface._onLine (readline.js:224:10)
    at REPLServer.Interface._line (readline.js:566:8)
    at REPLServer.Interface._ttyWrite (readline.js:843:14)
```

**代码实现如下:**
```js
#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const repl = require('repl');

const ctx = repl.start('> ').context;

ctx.load = name => {
    const real_name = require.resolve(name);
    const module_name = path.basename(name).split('.')[0].replace(/-+(\w)/g, (str, $1) => {
        return $1.toUpperCase();
    });

    try {
        ctx[module_name] = require(real_name);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

ctx.reload = name => {
    const time = Date.now();

    ctx.clear(name);
    ctx.load(name);

    console.log(`\x1b[32mreload success, use time: ${Date.now() - time}ms\x1b[0m`);
};

ctx.clear = name => {
    const real_name = require.resolve(name);
    if (require.cache[real_name]) {
        delete ctx[name];
        _clear(real_name);
        delete require.cache[real_name];
    }

    function _clear(real_name) {
        require
            .cache[real_name]
            .children
            .map((mod, idx, arr) => {
                return mod.id;
            })
            .forEach((mod_name, idx, arr) => {
                if (require.cache[mod_name].children.length) _clear(mod_name);
                else delete require.cache[mod_name];
            });
    }
};
```