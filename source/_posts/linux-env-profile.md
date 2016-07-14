---
title: linux变量与别名的有效期与环境配置文件
date: 2016-04-16 00:54:20
categories: 
- 系统
tags:
- linux
---

默认情况下，在shell下的用户变量，别名等，只有在此次登陆中有效。一旦关闭终端或注销后，设置将会恢复初始值。
<!--more-->
### 有效期
用户可以将这些设置放入一个系统环境配置文件中，使其长期生效。
每一个用户都有一个登录Shell，且默认为bash，党用户打开一个bash时，系统就去读取~/.bahsrc配置文件。因此可以将相关设定放入此文件中。

### 环境配置文件
bash会在用户登录时读取下列四个环境配置文件：
- 全局环境配置文件: /etc/profile, /etc/bashrc(ubuntu下是/etc/bash.bashrc)
- 用户环境配置文件: ~/.bash_profile(ubuntu下是~/.profile), ~/.bashrc

1. /etc/profile: 此文件为系统每个用户设置环境信息，系统中每个用户登录时都要执行这个脚本，如果系统管理员希望某个设置对所有用户都生效，可以写在这个脚本里，该文件会从/etc/profile.d目录中的配置文件中搜集shell设置。
2. /etc/&lt;bashrc|bash.bashrc&gt;: 为每一个运行bash shell的用户执行此文件.当bash shell被打开时,该文件被读取。
3. ~/&lt;.bash_profile|.profile&gt;: 每个用户都可使用该文件设置专用于自己的shell信息，当用户登录时，该文件仅被执行一次。默认情况下，它设置一些环境变量，执行用户的.bashrc文件
4. ~/.bashrc: 该文件包含专用于你的bash shell的bash信息,当登录时以及每次打开新的shell时,该文件被读取。

由此可见/etc/profile和~/&lt;.bash_profile|.profile&gt;仅在用户登录时执行一次，而/etc/&lt;bashrc|bash.bashrc&gt;和~/.bashrc是每次打开新shell时被执行。

执行顺序:
- centos: /etc/profile  ~/.bash_profile  ~/.bashrc  /etc/bashrc  (实则是执行~/.bash_profile的时候加载了~/.bashrc，而~/.bashrc又加载了/etc/bashrc)
- ubuntu: /etc/profile  /etc/bash.bashrc  ~/.profile  ~/.bashrc  (实则是执行/etc/profile时加载了/etc/bash.bashrc，执行~/.profile时加载了~/.bashrc)

就执行顺序而言，感觉ubuntu更符合常理，有点像编程语言里面的局部变量屏蔽全局变量，所以对应的用户环境配置后加载于全局环境配置文件。