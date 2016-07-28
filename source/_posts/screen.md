---
title: 使用screen终端复用器
date: 2016-07-28 14:50:57
categories: 
- 系统
tags:
- linux
---

## **前言**
自从租了云服务器后，经常需要使用SSH进行远程登录管理，每次进行耗时操作时为了防止该任务独占会话以及断开连接时任务终止，我会使用nohup命令将任务与当前会话分离，使用命令如下:

	$ nohup wget <url> &

nohup命令对wget做了三件事:

- 阻止SIGHUP信号发送到该进程
- 关闭标准输入
- 重定向标准输出和标准错误到文件nohup.out

这样wget就能安全的运行在后台，并不会随着会话的结束而结束，但其缺点是，浏览命令的执行结果变得不那么直观(需要打开nohup.out文件)。而screen终端复用器正好能满足我们的需求。

<!--more-->
## **正文**
screen是一个终端复用器，可以在一个终端里进行多个会话的管理，而每个会话中又能创建多个窗口。

我的玩法是先创建一个会话，然后在该会话中创建多个窗口，接着你可以在某些窗口中执行一些耗时任务，并使用快捷键切换到另外的窗口执行其他任务或来回查看运行结果，还可进行多会话切换，总之要多方便有多方便:-)

screen的常用用法如下:
```sh
$ screen -S name //新建一个名为name的会话
$ screen -ls     //列出当前所有会话
$ screen -r name //回到name会话
$ screen -d name //使name会话离线
$ screen -d -r name //结束当前会话并回到name会话    
```

在每个screen session 下，所有命令都以 ctrl+a(C-a) 开始, 用法如下:
```
C-a c -> Create，创建一个新窗口
C-a n -> Next，切换到下一个窗口
C-a p -> Previous，切换到前一个窗口
C-a 0..9 -> 切换到第 0..9 个窗口
C-a w -> Windows，列出当前会话已有窗口
C-a k -> kill window，强行关闭当前的窗口
C-a d -> detach,离线当前会话(将会话移至后台，会话中的进程依然在执行)，回到screen之前状态
```

## 参考文献
- [Linux 守护进程的启动方法](http://www.ruanyifeng.com/blog/2016/02/linux-daemon.html?hmsr=toutiao.io&utm_medium=toutiao.io&utm_source=toutiao.io)
- [百度百科screen](http://baike.baidu.com/link?url=eWnNJ4sC7W_5vNDDYIencLCZxBvMaDnUZ0f807V5NILmbfvRlR8eS2AtPXeSzKqZyCI5gyU_T_XRDe8SPOO3QTsW0XGCzYhQvAIp11YPYNi)