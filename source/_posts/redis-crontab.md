---
title: Node.js 中使用 Redis 来实现定时任务
date: 2016-07-03 10:19:42
categories: 
- 代码
tags:
- Node.js
- redis
---

## **前言**
最近在cnode社区看到死月大神写了一篇关于redis定时任务的文章，其中的序言时这样的:
> 本文所说的定时任务或者说计划任务并不是很多人想象中的那样，比如说每天凌晨三点自动运行起来跑一个脚本。这种都已经烂大街了，随便一个 Crontab 就能搞定了。
这里所说的定时任务可以说是计时器任务，比如说用户触发了某个动作，那么从这个点开始过二十四小时我们要对这个动作做点什么。那么如果有 1000 个用户触发了这个动作，就会有 1000 个定时任务。于是这就不是 Cron 范畴里面的内容了。
举个最简单的例子，一个用户推荐了另一个用户，我们定一个二十四小时之后的任务，看看被推荐的用户有没有来注册，如果没注册就给他搞一条短信过去。Σ>―(〃°ω°〃)♡→

看完后联想起**"快递一直放在快递柜没领，然后隔个24小时就发一条短信给你，如果有多个快递，就有多条每隔24小时的短信发给你(吗哒，要疯啦w(ﾟДﾟ)w!)"**的例子类似的，想着以后可能也会遇到这种需求，于是研究了一番。。。

<!--more-->
## **正文**
上文实现采用的是redis，在redis 2.8.0版本之后，推出了一个新的特性键空间消息（[Redis Keyspace Notifications](http://redis.io/topics/notifications)），配合2.0.0版本的**SUBSCRIBE** 就能完成这个定时任务的操作了。

采用redis的好处:
- 被动接受消息，相对于主动轮询被动接受效率更高。
- 数据持久化，进程重启时任务数据不会丢失。
- 跨进程通信，设置任务方和订阅消息方可以是不同进程。
- 高效的第三方数据维护，内存管理更高效，解决了node单进程内存上限的问题。

### **Keyspace Notifications**
所谓的键空间通知，即是当某个键过期或者被修改时，会触发特定事件，并向订阅了该事件对应的通道推送消息。
默认情况下对于每个修改数据库的操作，键空间通知都会发送两种不同类型的事件。
比如说，对 0 号数据库的键 mykey 执行 DEL 命令时， 系统将分发两条消息， 相当于执行以下两个 PUBLISH 命令：
```sh
PUBLISH __keyspace@0__:mykey del
PUBLISH __keyevent@0__:del mykey
```
订阅第一个频道 __keyspace@0__:mykey 可以接收 0 号数据库中所有修改键 mykey 的事件， 而订阅第二个频道 __keyevent@0__:del 则可以接收 0 号数据库中所有执行 del 命令的键。

以 keyspace 为前缀的频道被称为键空间通知（keyspace notification）， 而以 keyevent 为前缀的频道则被称为键事件通知（keyevent notification）。

当 del mykey 命令执行时：

- 键空间频道的订阅者将接收到被执行的事件的名字，在这个例子中，就是 del 。
- 键事件频道的订阅者将接收到被执行事件的键的名字，在这个例子中，就是 mykey 。

### **配置**
因为开启键空间通知功能需要消耗一些 CPU ， 所以在默认配置下， 该功能处于关闭状态。

可以通过修改 redis.conf 文件， 或者直接使用 CONFIG SET 命令来开启或关闭键空间通知功能：

1. 当 notify-keyspace-events 选项的参数为空字符串时，功能关闭。
2. 另一方面，当参数不是空字符串时，功能开启。

notify-keyspace-events 的参数可以是以下字符的任意组合， 它指定了服务器该发送哪些类型的通知：

- K，表示 keyspace 事件，有这个字母表示会往 __keyspace@<db>__ 频道推消息。
- E，表示 keyevent 事件，有这个字母表示会往 __keyevent@<db>__ 频道推消息。
- g，表示一些通用指令事件支持，如 DEL、EXPIRE、RENAME 等等。
- $，表示字符串（String）相关指令的事件支持。
- l，表示列表（List）相关指令事件支持。
- s，表示集合（Set）相关指令事件支持。
- h，哈希（Hash）相关指令事件支持。
- z，有序集（Sorted Set）相关指令事件支持。
- x，过期事件，与 g 中的 EXPIRE 不同的是，g 的 EXPIRE 是指执行 EXPIRE key ttl 这条指令的时候顺便触发的事件，而这里是指那个 key 刚好过期的这个时间点触发的事件。
- e，驱逐事件，一个 key 由于内存上限而被驱逐的时候会触发的事件。
- A，g$lshzxe 的别名。也就是说 AKE 的意思就代表了所有的事件。

由于上文的需求，只需设置值为Ex就能满足。

    notify-keyspace-events Ex

配置完后，重启redis服务后，测试如下:

启动一个客户端，对0号数据库订阅过期键事件通知
```sh
127.0.0.1:6379> SUBSCRIBE __keyevent@0__:expired
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "__keyevent@0__:expired"
3) (integer) 1
```
启动另一个客户端，设置mykey值为hh过期时间为5秒

    127.0.0.1:6379> SET mykey hh EX 5

5秒后查看之前的客户端显示
```sh
127.0.0.1:6379> SUBSCRIBE __keyevent@0__:expired
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "__keyevent@0__:expired"
3) (integer) 1
1) "message"
2) "__keyevent@0__:expired"
3) "mykey"
```

### **Node.js中的实践**
好的，接着我们来实现上面具体的逻辑，用邮件代替发短信，只写了创建任务和消费任务的逻辑，其余像什么判断用户是否取件并不是重点，真的遇到后具体问题具体实现，代码如下:

```js
// app.js
const Redis = require('ioredis');
const tasks = require('./tasks.js');    // 任务函数文件
const conf = require('./conf.js');
const redis = new Redis(conf.redis_opts);
const sub = new Redis(conf.redis_opts);

sub.once('connect', () => {

    sub.subscribe(conf.sub_key, (err, count) => {
        if (err) {
            handleError(err);
        } else {
            console.log(`subscription success, subscription count is: ${count}`);
            // 创建发邮件的定时任务
            createCrontab('sendMail', ['153330685@qq.com'], 5);
        }
    });

});
// 监听消息
sub.on('message', crontabTrigger);

/* 生产唯一id
 * @return {String} uid 唯一id值 
 */

let genUID = (() => {
    let num = 0;

    function getIncNum() {
        if (num >= 10000) num = 0;
        return '0'.repeat(4 - String(num).length) + num++;
    }

    return () => {
        return Date.now() + getIncNum();
    };
})();

/* 创建定时任务
 * @param {String} fn 函数名
 * @param {Array} args 函数参数
 * @timeout {Number} timeout 过期时间
 */

function createCrontab(fn, args, timeout) {
    // 添加唯一id的原因是应对同一毫秒，同函数同参数的key，会进行覆盖
    const cron_key = `${genUID()}:${fn}:${JSON.stringify(args)}`;
    // 设置定时任务
    redis.set(cron_key, '', 'EX', timeout, (err, result) => {
        if (err) {
            handleError(err);
        } else {
            console.log(`create crontab status: ${result}`);
        }
    });
}

/* 定时任务触发器
 * @param {String} channel 订阅频道
 * @param {String} key 定时任务的键
 */

function crontabTrigger(channel, key) {

    const fileds = key.split(':');
    if (fileds.length < 3) return;

    // 去掉key的uid
    fileds.shift();
    // 获取函数名
    const fn_name = fileds.shift();
    
    // 获取函数参数
    // 如果剩余字段数大于1，说明参数中有带':'的参数，需要重新拼接回去
    // 字段数等于1时,join后返回原数组第一个元素
    let args = fileds.join(':');

    try {
    	// 解析函数参数, 多参数时, args为数组
        args = JSON.parse(args);
    } catch (e) {
    	handleError(e);
    }

    console.log('---------------%s : %s--------------',fn_name, args);

    // 获取函数
    const fn = tasks[fn_name];
   	// 执行函数
   	fn(...args);
}

/* 错误处理函数
 * @param {Error} err 错误对象
 */

function handleError(err) {
    console.log(err);
    process.exit(1);
}

```
### 参考文献
[Node.js 中使用 Redis 来实现定时任务](https://cnodejs.org/topic/5577b493c4e7fbea6e9a33c9)
[Redis Keyspace Notifications](http://redis.io/topics/notifications)