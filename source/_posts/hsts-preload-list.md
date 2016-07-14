---
title: 给博客域名申请了加入HSTS preload list
date: 2016-06-21 19:42:58
categories: 
- 博客
tags: 
- https 
---
目前还在申请中:
![hsts-preload-list](/img/hsts-preload-list.png)

<!--more-->


那么什么是HSTS preload list呢? 回答这个问题先要从HSTS谈起。HSTS全称HTTP Strict Transport Security(HTTP严格传输安全)。在介绍HSTS之前先来看下https用户访问过程:

![tcp-handshake](/img/tcp-handshake.png)

从上图可以看出，用户在浏览器输入网址如geemo.top,通常不带协议时，浏览器默认发起http请求，然后后端服务器响应https 302跳转后浏览器重新对服务器发起https请求。以上过程存在如下问题:

- 前两次无效的RTT(往返时间)
- 请求时可能在进行敏感数据提交

而HSTS解决了上述两个问题。

**HSTS工作机制**: 服务端在响应头添加了HTST字段，浏览器获取该信息后，会对接下来的所有http请求进行**内部307跳转(无需网络过程)**到https。

但HSTS在第一次访问时无效(因为至少要进行一次访问才能获取到HSTS字段信息嘛)，要解决这个问题就需要了解下面介绍的HSTS preload list了。

**HSTS preload list**: Chrome浏览器中的HSTS预载入列表，在该列表中的网站，使用Chrome浏览器访问时，会自动转换成HTTPS。Firefox、Safari、Edge浏览器也在采用这个列表。

如何加入HSTS preload list，在https://hstspreload.appspot.com (需翻墙)提交，提交以及生效条件如下:

![hsts-submit](/img/hsts-submit.png)

**参考文献**
[HSTS preload list 申请网址](https://hstspreload.appspot.com)
[解决缺陷,让HSTS变得完美](https://cnodejs.org/topic/56dfd7e2255ed94c6e4c26fb)