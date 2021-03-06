---
title: 浅谈tcp拥塞控制和如何提高网络吞吐量的机制
date: 2016-09-22 16:54:20
categories: 
- 网络
tags:
- algorithm
---
## **前言**

之前用node的net模块时，翻了一下官方文档，无意间看到了一个这样的方法:
```
socket.setNoDelay([noDelay])#

Disables the Nagle algorithm. By default TCP connections use the Nagle algorithm, they buffer data before sending it off.
Setting true for noDelay will immediately fire off data each time socket.write() is called. noDelay defaults to true.

Returns socket.
```
这api的作用是禁用tcp Nagle算法⊙_⊙(什么鬼，Nagle算法是什么。。。怎么没听说过。。赶紧百度百度。到时候被人问到时，还能装一装逼o(*≧▽≦)ツ┏━┓)

<!--more-->
## **正文**

### **Nagle的由来**

Nagle算法之所以以Nagle命名，基本能断定发明这算法的人的名字中有Nagle(哎。。这些历史名人的故事咱也就不扯了，爱看自己百度去)。

### **Nagle算法的作用**

**Nagle算法主要是为了避免网络因为太多小包而拥塞**，举个栗子:
假如某个应用程序频繁的产生1个字节的数据，可能在传输上会造成64字节的包。其中包括1字节的有用信息和63字节的首尾部信息和填充数据的和。这种情况转变成了6300%的消耗，
这样的情况对于轻负载的网络来说还是可以接受的，但是重负载的网络就受不了了。造成的结果可能导致数据因超时到达目的地而进行重传，进而加重网络负担，到达一定程度上导致网络连接失败。

Negle采取的策略是**任意时刻，传输网络中只有一个未被确认的小段(小于MSS大小的数据块，即小于1460字节)。**通俗的解释是，一个数据包发送出去后，没有收到对端的确认，则在特定条件内不允许发送下一个数据包。
Negle算法**允许发送下一个数据包**的规则如下:

- 包长度到达MSS
- 如果该包包含FIN标志位(即为终止数据包，发送后进入断开连接状态或者半断开状态)
- 设置了**TCP_NODELAY**选项，即socket.setNoDelay(true)时
- 未设置**TCP_CORK**选项时，发出的小于MSS的数据包均得到ACK确认后
- 未满足上述条件，但发生超时(200ms)

然而数据到达了对端，对端并不会对数据立即进行ACK确认，这里牵扯到一个**TCP确认延迟机制**，之所以需要延迟一段时间(通常初始值40ms,会变动),是因为希望在一段时间内对端将应答数据连同ACK确认一起返回(增加网络利用率)。
另外可以通过设置**TCP_QUICKACK**选项来取消确认延迟。

### **CORK算法**

CORK的中文解释是塞子的意思，其目的是尽量把多个小数据包拼接成一个大数据包(一个MSS)再发送出去，形象的描述就是当瓶子里的水满了后才打开塞子让水流出(起到一个缓存作用，增加网络利用率),当然前提条件是小于超时发送时间(一般200ms)。
若应用层程序发送小包数据的间隔不够短时，每个小包数据都会延时一定时间再发送，反而失去了数据的实时性，当然可以通过设置**TCP_CORK**选项使之禁用。

### **Nagle算法与CORK算法的区别**

Nagle算法主要避免网络因为太多的小包（协议头的比例非常之大）而拥塞，而CORK算法则是为了提高网络的利用率，使得总体上协议头占用的比例尽可能的小。
注意前者关注的是网络拥塞问题，后者关注的是内容，这点不要搞混了!

于是乎在不考虑网络拥塞的情况下，是否通过设置**TCP_NODELAY**，**TCP_QUICKACK**以及**TCP_CORK**就可以配置出最佳实时性的配置，有待考证，但想想是否有些小激动!!!
