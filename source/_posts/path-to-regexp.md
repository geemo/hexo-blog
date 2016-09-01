---
title: express路由解析核心,pathtoRegexp源码解析
date: 2016-09-01 15:22:42
categories: 
- 代码
tags:
- Node.js
---
其实很早就想着仿写express的，想着总有一天用纯原生重写之前写过的一个论坛，但仿写express，肯定得先明白其路由解析的正则匹配规则把。
于是就花了一两天时间研究了一下path-to-regexp模块，话说这正则确实之前看的有点头大，不过完全看懂后，感觉自己的正则水平提升了不少，
这时间花的还是值得的。

闲话不多说，直接上代码把，注释全部写在代码里。理解是一回事，写出又是一回事，接下来花几天自己撸出来看看！
<!--more-->

```js
/**
 * express路由解析，路径转正则模块源码解读
 * /

/**
 * 导出pathtoRegexp
 */
module.exports = pathtoRegexp;

/**
 * 此正则用在path参数为字符串的情况
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // 将已经转义过的字符匹配出，然后进行原样返回，防止再次进行转义
  '(\\\\.)',
  // 匹配带前缀和可选后缀的express风格参数和未命名参数，情况如下:
  // 数组中的元素代表含义[prefix, key, capture, group, suffix]
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?"]
  // "/route(\\d+)" => [undefined, undefined, undefined, "\d+", undefined]
  '([\\/.])?(?:\\:(\\w+)(?:\\(((?:\\\\.|[^)])*)\\))?|\\(((?:\\\\.|[^)])*)\\))([+*?])?',
  // 用来匹配应该被转义的特殊字符
  '([.+*?=^!:${}()[\\]|\\/])'
].join('|'), 'g');

/**
 * 转义捕获组中的特殊字符
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1');
}

/**
 * 将捕获的keys数组附加到正则表达式上
 *
 * @param  {RegExp} return
 * @param  {Array}  keys
 * @return {RegExp}
 */
var attachKeys = function (re, keys) {
  re.keys = keys;

  return re;
};

/**
 * 将path转化为正则表达式
 *
 * 接受一个空数组keys用来存放包含placeholder key的对象，例如:
 * /user/:name/:age 会将id放在数组中[{name: name, delimiter: '/', ...}, {name: age, delimiter: '/', ...}]
 *
 * @param  {(String|RegExp|Array)} path 待转化的路径参数
 * @param  {Array}  keys 
 * @param  {Object} options 包含strict(严格模式)，end(末尾匹配模式,当为true时,转换的正则末尾会加$,反之不加),sensitive(是否大小写敏感)
 * @return {RegExp}
 */
function pathtoRegexp (path, keys, options) {
  if (keys && !Array.isArray(keys)) {
    options = keys;
    keys = null;
  }

  keys = keys || [];
  options = options || {};

  var strict = options.strict;
  var end = options.end !== false;
  var flags = options.sensitive ? '' : 'i';
  var index = 0; // 用来记录未命名参数的捕获组的索引

  // path为正则表达式的情况
  if (path instanceof RegExp) {
    // 匹配所有捕获组，其实就是一堆右接非问号的左括号，如'()'会被匹配,而'(?:)'不会被匹配
    var groups = path.source.match(/\((?!\?)/g) || [];

    // 将所有groups成员映射为统一的key对象
    keys.push.apply(keys, groups.map(function (match, index) {
      // 说实话主要就是为了记录一个index，根本不需要后面的几个字段，估计是为了统一
      return {
        name:      index,
        delimiter: null,
        optional:  false,
        repeat:    false
      };
    }));

    // 返回附加keys后的正则对象
    return attachKeys(path, keys);
  }

  // 如果path是数组的情况
  if (Array.isArray(path)) {
    // 迭代调用pathtoRegexp函数进行正则转换
    path = path.map(function (value) {
      // 正则对象字符串
      return pathtoRegexp(value, keys, options).source;
    });

    // 将正则字符串数组拼接成单独的正则字符串，转化成正则对象，附加keys后返回
    return attachKeys(new RegExp('(?:' + path.join('|') + ')', flags), keys);
  }

  // path为字符串的情况.
  // match为整体匹配结果，后面七个字段为PATH_REGEXP的七个捕获组
  // escaped 匹配已转义的字符
  // prefix 匹配前缀为'/'或'.'的字符
  // key 匹配占位key，如/user/:id中的id
  // capture 匹配express风格参数的捕获组，如'/:test(\\d+)', capture为'\d+', 
  // group 匹配未命名参数的捕获组，如'/route(\\d+)'，capture为undefined,group为'\d+'
  // suffix 匹配后缀,如+ ? *等
  // escape 匹配未转义的特殊字符
  path = path.replace(PATH_REGEXP, function (match, escaped, prefix, key, capture, group, suffix, escape) {
    // 避免重复转义已转义过的特殊字符
    if (escaped) {
      return escaped;
    }

    // 对特殊字符进行转义
    if (escape) {
      return '\\' + escape;
    }

    var repeat   = suffix === '+' || suffix === '*';
    var optional = suffix === '?' || suffix === '*';

    keys.push({
      name:      key || index++,
      delimiter: prefix || '/',
      optional:  optional,
      repeat:    repeat
    });

    // 转义前缀字符
    prefix = prefix ? '\\' + prefix : '';

    // 匹配自定义捕获组，如/user/:id(\\d+)只有在id为数字的情况下才能匹配, '(\\d+)'就是自定义捕获组,
    // 或者向后捕获任何东西直到下一个'/'(或者下一个'.'，如果prefix是'.')
    capture = escapeGroup(capture || group || '[^' + (prefix || '\\/') + ']+?');

    // Allow parameters to be repeated more than once.
    if (repeat) {
      capture = capture + '(?:' + prefix + capture + ')*';
    }

    // 允许参数可选，如'/test.:ext?'可以匹配'/test.json'也可以匹配'/test'
    if (optional) {
      return '(?:' + prefix + '(' + capture + '))?';
    }

    // Basic parameter support.
    return prefix + '(' + capture + ')';
  });

  // 检查path是否是以'/'结尾
  var endsWithSlash = path[path.length - 1] === '/';

  // 在非严格模式下，允许以可选的尾部'/'匹配，如果path已经是已'/'结尾，
  // 为了一致性，我们需要移除它,并转成'(?:\\/(?=$))?',在非end模式下这是非常重要的，否则,
  // '/test/'将匹配'/test//route'。之所以path.slice(0, -2),是因为'/'是特殊字符会被转成'\/'。
  if (!strict) {
    path = (endsWithSlash ? path.slice(0, -2) : path) + '(?:\\/(?=$))?';
  }

  // 非end模式，主要就是排除了'/test/'匹配'/test//route'的情况
  if (!end) {
    path += strict && endsWithSlash ? '' : '(?=\\/(?!\\/)|$)';
  } else {
    path += '$';
  }

  return attachKeys(new RegExp('^' + path, flags), keys);
};

```