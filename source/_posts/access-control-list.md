---
title: 访问控制列表(ACL)
date: 2016-06-08 14:13:03
categories:
- 系统
tags:
- linux
---

**ACL**(Access Control List)是标准**UNIX**文件属性(r, w, x)的附加扩展。
**ACL**给予用户和管理员更好的控制文件读写和权限赋予的能力，
**Linux**从2.6内核开始对**Ext4,XFS,JFS**等文件系统的**ACL**支持。
<!--more-->

- **[为什么要使用ACL](#为什么要使用ACL)**
- **[Linux是否支持ACL](#Linux是否支持ACL)**
- **[ACL的名词定义](#ACL的名词定义)**
- **[如何设置ACL文件](#如何设置ACL文件)**
- **[参考文献](#参考文献)**

## 为什么要使用ACL
在**Linux**中，对一个文件可进行操作的对象分为三类:u(user),g(group),o(other)。
例如:
```sh
$ ls -l test
-rw-rw---- 1 test geemo 0 Jun  8 20:08 test
```
若现在希望用户**xiaomai**也可以对**test**文件进行读写操作，有以下几种办法(假设**xiaomai**不属于**geemo**组)。
1. 给文件的**other**增加**rw**权限。
2. 将**xiaomai**添加到**geemo**组。
3. 在**xiaomai**登陆会话状态下，使用sudo命令。

以上方法存在如下问题:
方法1: 所有**other**用户将对**test**文件具有读写权限。
方法2: **xiaomai**权限过大，可对所有属于**geemo**组的文件具有同等的组权限。
方法3: 虽然可以只限定**xiaomai**用户一人拥有对**test**的读写权限，
      但是需要对**sudoers**文件进行严格的格式控制，而且当文件数量和用户数量很多时，
      此方法就不灵活了。

看来好像没有一个好的解决方案，其实问题出在**Linux**的文件权限方面，对**other**定义过于宽泛，
以至于很难把"**权限**"限定在一个不属于**user**和**group**的用户。而**ACL**就是用来帮助用户解决这个问题的。

**ACL**可以以某个文件单独设置该文件具体的某用户或某组的权限。需要掌握的命令有三个:getfacl,setfacl,chacl。

- **getfacl <文件名>**                                 //获取文件访问控制信息
- **setfacl -m user:用户名:权限 <文件名>**              //设置某个用户名的访问权限
- **setfacl -m group:组名:权限 <文件名>**               //设置某个组名的访问权限
- **setfacl -x user:用户名 <文件名>**                   //取消某个用户名的访问权限
- **setfacl -x group:组名 <文件名>**                   //取消某个组名的访问权限
- **chacl user:用户名:权限,group:组名:权限 <文件名>**    //修改文件的访问控制信息

## Linux是否支持ACL
因为**Linux**系统并不是每个版本都支持**ACL**功能，因此需要先检查系统核心是否支持ACL。
```sh
$ cat /boot/config-4.2.0-36-generic | grep -i acl
CONFIG_EXT4_FS_POSIX_ACL=y
CONFIG_REISERFS_FS_POSIX_ACL=y
CONFIG_JFS_POSIX_ACL=y
CONFIG_XFS_POSIX_ACL=y
CONFIG_BTRFS_FS_POSIX_ACL=y
CONFIG_F2FS_FS_POSIX_ACL=y
CONFIG_FS_POSIX_ACL=y
CONFIG_TMPFS_POSIX_ACL=y
CONFIG_HFSPLUS_FS_POSIX_ACL=y
CONFIG_JFFS2_FS_POSIX_ACL=y
CONFIG_NFS_V3_ACL=y
CONFIG_NFSD_V2_ACL=y
CONFIG_NFSD_V3_ACL=y
CONFIG_NFS_ACL_SUPPORT=m
CONFIG_CEPH_FS_POSIX_ACL=y
CONFIG_CIFS_ACL=y
CONFIG_9P_FS_POSIX_ACL=y
```
如上含有**POSIX_ACL=y**的选项表示支持。

如需打开文件系统的**ACL**支持，需要修改**/etc/fstab**的挂载选项参数，例如，针对**/opt**文件系统:
**LABEL=/opt /opt ext4 rw,acl 1 2**
```sh
$ mount -v -o remount /opt
$ mount -l
...
/dev/sda10 on /opt type ext4 (rw,acl)
...
```
## ACL的名词定义
**ACL**是由一系列的**Access Entry**组成，每一条**Access Entry**定义了特定的类别，可以对文件拥有的操作权限。
**Access Entry**有三个组成部分: **Entry tag type,qualifier(optional),permission**.
#### Entry tag type类型如下:
- **ACL_USER_OBJ**: 相当于Linux中**file_owner**的权限
- **ACL_USER**: 定义了额外的用户对此文件的权限
- **ACL_GROUP_OBJ**: 相当于Linux中group的权限
- **ACL_GROUP**: 定义了额外的组对此文件拥有的权限
- **ACL_MASK**: 定义了ACL_USER, ACL_GROUP_OBJ, ACL_GROUP的最大权限
- **ACL_OTHER**: 相当于Linux中other的权限

示例如下：

```bash
$ getfacl test
# file: test
# owner: test
# group: geemo
user::rw-        //定义了ACL_USER_OBJ,说明文件拥有者对文件拥有读写权限
user:xiaomai:rw- //定义了ACL_USER,说明用户xiaomai对文件拥有读写权限  
group::rw-       //定义了ACL_GROUP_OBJ,说明了文件的group拥有读写权限
group:geemo:r--  //定义了ACL_GROUP,说明geemo组对文件拥有读权限
mask::rw-        //定义了ACL_MASK,说明了ACL_USER, ACL_GROUP_OBJ, ACL_GROUP的最大权限为读写权限
other::r--       //定义了ACL_OTHER，说明了other的权限为读权限
```
前面三个以#开头的行时注释，可以用--omit-header省略。
## 如何设置ACL文件
从上面的例子中可以看到，每一个**Access Entry**都是由三个被**分号(:)**分隔开的字段所组成。
#### 第一个是入口标志类型(Entry tag type):
- user对应着ACL_USER_OBJ和ACL_USER。
- group对应着ACL_GROUP_OBJ和ACL_GROUP。
- mask对应着ACL_MASK。
- other对应着ACL_OTHER。

#### 第二个是限定(qualifier):
- 也就是上面例子中对应的xiaomai用户和geemo组，它定义了特定用户和组对于文件的权限，这里只有user和group才有限定，其他都为空。

#### 第三个是权限(permission):
- 和Linux中的权限一样。

下面来看一下如何设置test文件的ACL来达到上面的要求。初始文件没有ACL的额外属性。

```bash
$ ls -l test
-rw-rw-r-- 1 test test 0 Jun  8 20:08
$ getfacl --omit-header test
user::rw-
group::rw-
other::r--
$ setfacl -m user:xiaomai:rw- test
$ setfacl -m group:geemo:r-- test
$ getfacl --omit-header test
user::rw-
user:xiaomai:rw-
group::rw-
group:geemo:r--
mask::rw-
other::r--
$ ls -l test
-rw-rw-r--+ 1 test test 0 Jun  8 20:08  //文件权限最后多了一个+号，表示该文件使用了ACL属性，是一个ACL文件
```

## 参考文献
[Linux操作系统(RHEL7/CentOS7)](http://baike.baidu.com/link?url=CflERfxDF1ozV8BqGYrfr-ahfr2PAXkwKQyXh1fPXvf10qiSbAtKxopqPj5mCrOV6nwmPRlVCHvF9OML1wQHoM6jLqJAsX0qxzBrVVyXgPwVjjXuZy0tHTQusx3t0tGVYpjJZT0-TwZ-l8lr0Ke-Aq)