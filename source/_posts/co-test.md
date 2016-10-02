---
title: 9行代码实现超超简版co
date: 2016-10-02 10:48:36
categories: 
- 代码
tags: 
- Node.js 
---

## **前言**
说说这几天的经历吧，前几天经由[笔兄](https://musclejack.github.io/)介绍，向我推荐了一个eleme的实习工作。本来正愁南昌找不到node的面试机会的，准备十月底结课后就去上海找的，却没想到机会来的这么突然，真心的谢谢笔兄以及帮我压缩简历(也就200字左右的简历转pdf居然10多M大小...)的那位eleme的前端哥们and面试我的node团队的leader以及二面的各位hr们(不知道你们叫什么抱歉啦...)。一轮走下来后，感觉公司做事很有条理，大家都很和善，这点我很喜欢。还有就是二面的时候，从大家的交流中也得知了这是一个很好玩的团队，其实真实的我也是比较真性情的(其实是骚，暴露了- -!)。
总体来说，这次面试对我来说收获还是很多的。由于自己第一次来上海，自己也没准备，回答问题时其实很多是没有经过大脑的。自己是个慢性子的人，在需要临场快速作答的环境下还是太紧张导致答错了很多或者没答全(其实leader问我的问题都是百分百接触过的，但是没答出来就是没答出来，不要找借口!)，这点需要加强练习啊。。。平时无论是写代码还是做事总是兴趣主导，行事方面没有条理，生活无规律，有时天昏地暗，有时懒散如猪，从今往后也会努力改变。
其它的也就不多说了，面试最终结果要等过完国庆才知道。其实即使没面上也没关系的，毕竟早已习惯伤痛_(:з」∠)_，面不上只能说明自己还没努力到能配得上那份工作的实力吧，一切随缘...当然失败我也不会放弃的。
另外，总感觉大家好帅(不限男女)啊，我的哥，还有好想加入eleme的github组织，感觉很装逼(原谅我是图标党)。

<!--more-->
## **正文**

使用过koa 1.x的肯定都知道co吧。嗯，对的，co是一个node的流程控制库，也是koa 1.x的核心部件。基础用法想必大家也知道，不知道的可以[点击这里](https://github.com/tj/co)。

co源码去掉注释也就一百多行，大家可以耐下心来读一读，主要就是co接受一个generator(生成器)函数，利用生成器函数状态机的特点，“**可以保存多个状态，以及可以手动控制状态的暂停与恢复**”来达到异步操作同步表达的目的。细节方面它把各种yieldable(yield后面接的对象;ES6没有限制yield后面可以跟的类型，但co对此做了限制，只能是promises,thunks,array,objects,generators,generator functions)的对象封装成promise，每次在碰到yield的地方进行暂停，然后等yield后面的promise由pending状态变为resolve状态后，调用co接受的生成器函数执行返回的迭代器的next方法恢复运行，以此往复，直到所有状态结束。

简化版实现以及测试如下:
```js
'use strict';
const fs = require('fs');
const path = require('path');

function readFile(path, encoding = 'utf8') {
	return new Promise((resolve, reject) => {
		fs.readFile(path, encoding, (err, data) => {
			if(err) return reject(err);
			resolve(data);
		});
	});
}

co(function *(){
	try {
		let res1 = yield readFile(path.resolve(__dirname, 'f1.txt'));
		console.log(res1);
		let res2 = yield readFile(path.resolve(__dirname, 'f2.txt'));
		console.log(res2);
	} catch(e) {
		console.error(e);
	}
});

// 9行co实现
function co(gen) {
	const it = gen(); //返回迭代器
	function next(value) {	//递归驱动函数，接受的value作为上一次yield的返回值
		const result = it.next(value); //next返回一个对象,如 {value: (promise|undefined), done: (false|true)}  前一次的yield的返回值，需要通过下一个it.next传参返回
		if(!result.done) //如果状态没有迭代结束
			result.value.then(next, it.throw.bind(it));	//promise由pending转resolve时继续递归执行，reject时抛出异常
	}
	next(); //执行
}
```

运行结果如下:

```bash
$ node co-test.js
f1.txt data
f2.txt data
```