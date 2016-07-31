---
title: Node.js Stream - 深入篇
date: 2016-07-31 09:04:24
categories:
- 代码
tags:
- Node.js
---
## **前言**

**如何让自我执行力得到解放**

这篇博文本打算星期五就写，硬生生的被我拖到了星期天(刷了两天动漫)，还有昨晚上打开手机看了一下，MD[我是狗](http://fkwebs.com)(对方网名，挺文艺的)又在这个时候问我问题，我表示我正在经历思想斗争(虽然还是被懒癌击败...),每个星期五星期六总会来(跟dayima似得)。。今天早上也总算是回过神来了。如何改变现状嘛╮（╯▽╰）╭，MDZZ我是狗天天给我压力，还是在我最脆弱的时刻。。。总的来说还是压力太小闲的，都快毕业的人啦，做事方面居然还是如此慵懒，现在我在此立誓，如果下次还这样，就让我是狗直播吞粪！哎，闲话也不多说，停滞不前也不是我的风格，想想以后美好的生活，嘛,瞬间有动力了，有木有！

<!--more-->
## **正文**

**如何通过流取到数据**

我们知道创建一个stream.Readable对象readable后，需要为其实现_read方法。该方法用于生产数据，将流连接到数据源，并通过调用其push方法将数据传递过来。然后下游(消耗方)通过调用readable.read(n)请求数据，并通过监听data事件来获取数据。
![how-data-comes-out](/img/how-data-comes-out.png)

**read**

read的逻辑可以用下图表示。
![read](/img/read.png)

**doRead**

doRead用来表示是否需要调用_read向数据源取数据，因为流中维护了一个缓存，当缓存足够多时，直接从缓存中取数据就行，其逻辑如下:
```js
  var doRead = state.needReadable;
  // 如果取走n个数据后，缓存中保有的数据不足这个量，便会从底层取一次数据。
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
  }

  if (state.ended || state.reading) {
    doRead = false;
  } else if (doRead) {
    state.reading = true;
    state.sync = true;

    if (state.length === 0)
      state.needReadable = true;
    //当该_read方法中触发的push为异步触发时，由于代码继续向下执行,
    //sync被设为false,等到push调用时，其中的sync必定为false,这也表明其时异步执行。
    this._read(state.highWaterMark);
    state.sync = false;
  
    if (!state.reading)
      n = howMuchToRead(nOrig, state);
  }
```
可读流中维护了一个状态对象readable._readableState,即为上面的state，其各属性的意思如下:

- length: 当前缓存中的数据量
- highWaterMark: 缓存池容量阀值
- ended: 为true表示数据源数据已取完，调用了push(null)时设置
- reading: 为true时表示正在生产数据
- sync: 表示push是同步还是异步调用
- needReadable: 触发readable事件的条件，当请求的数据量大于缓存中的数据量时
- flowing: 初始值为null，流动模式为true，暂停模式为false

**push方法**

下游(消耗方)通过调用read(n)促使流输出数据，而流通过_read()间接调用push方法将数据传递过来。

如果在流动模式(state.flowing === true)下输出数据，只需监听data事件，数据会源源不断通过data事件传输，无需反复调用read(n)。

执行read方法时，在调用_read后，如果从缓存中取到了数据，就以data事件输出。

如果_read异步(state.sync === false)调用push时发现缓存为空(state.length === 0)，则意味着当前数据是下一个需要的数据，且不会被read方法输出(return null)，应当在异步push方法(并非push为异步，而是调用其的回调不在同一个tick)中立即以data事件输出。

因此，上图中“立即输出”的条件是：
```js
state.flowing && state.length === 0 && !state.sync
```

**howMuchToRead**

m = howMuchToRead(n)表示read(n)取数据时实际能够提供的量m。

- n通常为0或undefined。
- read(0)不会有数据输出，但从前面对doRead的代码(state.length - n < state.highWaterMark)可以看出，是有可能从底层读取数据的。
- 执行read()时(n为undefined)，由于流动模式下数据会不断输出，所以每次只输出缓存中第一个元素输出，而非流动模式则会将缓存读空。
- objectMode为true时，m为0或1。此时，一次push()对应一次data事件。

**readable事件**

在read(n)请求数据时，如果_read是异步调用push方法，此时数据通常是不够的，因此read(n)可能返回null。

read(n)返回null，表明此次未能取到所需量的数据，此时消耗方需要等到新的数据到达后再尝试调用read方法。

在数据到达后，流是通过readable事件来通知消耗方的。
在此种情况下，push方法如果立即输出数据，接收方直接监听data事件即可，否则数据被添加到缓存中，需要触发readable事件。
消耗方必须监听这个事件，再调用read方法取得数据。

**end事件**

只有当state.length === 0，且state.ended === true(执行_read取数据,调用push(null)后设置，意味着数据源已取完)，才意味着所有的数据都被消耗了。
一旦再执行read(n)时检测到这个条件，便会触发end事件。这个事件只会触发一次。

未完待续...

### 参考文献
[官方源码](https://github.com/nodejs/node/blob/master/lib/_stream_readable.js)

[stream-进阶篇](http://fe.meituan.com/stream-internals.html)