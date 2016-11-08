---
title: 浅析CSP
date: 2016-11-07 9:48:36
categories: 
- 网络
tags: 
- HTTP 
---

CSP(Content Security Policy), 即内容安全策略。可以通过http响应头或`<meta>`标签的方式引入, 其作用是制定一套资源加载策略，防御XSS攻击。

<!-- more -->

### **之前的做法**

本人之前利用浏览器机制防御xss攻击的做法是引入`x-xss-protection`响应头，其值有以下三种情况：
- 0: 禁用xss保护
- 1: 启用xss保护，默认启动
- 1; mode=block: 启用xss保护，并在监测到xss攻击时阻止浏览器渲染

然后指定其值为`1; mode=block`。其实这并没什么卵用，因为浏览器本来就默认开启了这种低级的xss保护，只是我额外的指定了其防御模式为`block`，也只能做到没卵用减减罢了。

### **更牛逼的做法**

使用csp制定一套白名单机制确实更为牛逼，其使用格式如下：

```
content-security-policy: 指令 [值 [值...]]; 指令 [值 [值...]]

//举个例子
content-security-policy: script-src 'self' geemo.top; image-src 'self'
```
即指令与值，值与值之间用空格分隔; 指令值(指令和值，即上面script-src 'self' geemo.top)之间用分号进行分隔。

上面的例子表明只允许加载来自同源或者geemo.top的js资源，以及只允许加载来自同源的图片资源。

一般的做法是：
```
content-security-policy: default-src 'xxx' 'xxx'; script-src 'xxx'; ...
// 即先定义默认的资源加载策略，后续指定针对具体的资源的加载策略
```

具体的支持的策略指令可以[访问这里](https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives)以及[一峰的博文](http://www.ruanyifeng.com/blog/2016/09/csp.html)and[屈大神的博文](https://imququ.com/post/content-security-policy-reference.html)

### **其它的想法**

本人在上次分享http2时谈到了采用localStorage存储inline js脚本达到对内联资源的缓存时说道，假如网站存在xss漏洞，对缓存在localStorage中的js进行了篡改，后果可想而知，所幸的是csp level2针对inline资源完整性检查方面提供了一个叫做Hashes的策略。

**Hashes**

该策略是通过指定许可的内联资源的哈希摘要签名，达到过滤非法inline资源的目的。该策略支持三种签名算法: `sha256`,`sha384`,`sha512`。

通过node.js来计算hashes值：
```js
const crypto = require('crypto');

function getHashByCode(code, algorithm = 'sha256') {
  return algorithm + '-' + crypto.createHash(algorithm).update(code, 'utf8').digest("base64");
}

getHashByCode('console.log("hello world");'); // 'sha256-wxWy1+9LmiuOeDwtQyZNmWpT0jqCUikqaqVlJdtdh/0='
```

设置csp头
```
content-security-policy: script-src 'sha256-wxWy1+9LmiuOeDwtQyZNmWpT0jqCUikqaqVlJdtdh/0='
```

```html
<script>console.log('hello geemo')</script> <!-- 不执行 -->
<script>console.log('hello world');</script> <!-- 执行 -->
```

**Subresource Integrity**

既然inline js资源得到了有效的防御，那么外部cdn呢？减少由托管在外部cdn上的资源被篡改而引入xss风险的策略是一个叫做Subresource Integrity(子资源完整性)监测的策略，使用方式如下:

```html
<!-- 签名方式与hashes相同，不同的是需要添加一个integrity属性 -->
<script src="//cdn.xxx.com/jquery.min.js" integrity="sha256-+ccdef9LmiuOeDwtQyZNmWpT0jqCUikqaqVlJdtdh/0="></script>
```
