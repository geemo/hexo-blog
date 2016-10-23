---
title: 原生模块打造一个简单的websocket服务器
date: 2016-10-23 10:48:36
categories: 
- 代码
tags: 
- Node.js 
---

众所周知，在http2之前，受制于协议本身的原因，http并不支持服务端主动推送。客户端需要采用轮询等方式与服务端进行双向实时通信，但产生的开销比较大。而html5中提出了一套websocket协议规范，使得客户端浏览器与服务端进行双向实时通信成为可能(具体参见[rfc6455](https://datatracker.ietf.org/doc/rfc6455/?include_text=1))，本文将介绍用node.js原生模块打造一个简单的ws服务器，[点击这里](https://github.com/geemo/test/tree/master/node/ws)获取完整代码。

<!--more-->
websocket protocol分为两部分：握手和数据传输

**1. 握手阶段**

- 客户端握手请求报文：
        GET /chat HTTP/1.1  //请求行
        Host: server.example.com
        Upgrade: websocket  //required
        Connection: Upgrade //required
        Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ== //required
        Origin: http://example.com  // 用于防止未认证的跨域脚本使用浏览器websocket api与服务端进行通信
        Sec-WebSocket-Protocol: chat, superchat  //optional, 子协议协商字段
        Sec-WebSocket-Version: 13

- 服务端响应报文:
        HTTP/1.1 101 Switching Protocols  //状态行
        Upgrade: websocket   //required
        Connection: Upgrade  //required
        Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo= //required
        Sec-WebSocket-Protocol: chat //表明选择的子协议

握手阶段，具体来讲，就是当浏览器脚本new WebSocket(url)后，浏览器对服务器发送一个协议升级的请求，请求中带有Sec-WebSocket-Key字段。服务端接收到协议提升请求后对这个字段加上一个特定的GUID后做一次sha1运算，然后再获取结果的base64格式摘要，作为Sec-WebSocket-Accept响应头的值响应回客户端浏览器，就完成了握手。具体代码如下：

```js
server.on('upgrade', (req, socket, head) => {
    // 固定GUID
    const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    // 获取客户端返回的key与GUID进行sha1编码后获取base64格式摘要
    let key = req.headers['sec-websocket-key'];
    key = crypto.createHash('sha1').update(key + GUID).digest('base64');

    // 返回101协议切换响应
    const resMsg = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Accept: ' + key,
        '\r\n'
    ].join('\r\n');

    socket.write(resMsg);
});
```

**2. ws帧解码与编码**

握手成功后，就可以进行数据传输了，然而不进行解码操作是得不到正确的结果的。
```js
socket.on('data', console.log.bind(console)); // 打印的数据类似是这样的格式<Buffer aa bb cc>
```

我们可以来看一下ws帧的完整格式：
```
      1               2               3               4              
      0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
     +-+-+-+-+-------+-+-------------+-------------------------------+
     |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
     |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
     |N|V|V|V|       |S|             |   (if payload len==126/127)   |
     | |1|2|3|       |K|             |                               |
     +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
     |     Extended payload length continued, if payload len == 127  |
     + - - - - - - - - - - - - - - - +-------------------------------+
     |                               |Masking-key, if MASK set to 1  |
     +-------------------------------+-------------------------------+
     | Masking-key (continued)       |          Payload Data         |
     +-------------------------------- - - - - - - - - - - - - - - - +
     :                     Payload Data continued ...                :
     + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
     |                     Payload Data continued ...                |
     +---------------------------------------------------------------+
```
解释如下：
- FIN: 表示帧是否结束，1结束，0没结束
- RSV[1-3]: 通常来说置零即可，但可以根据扩展协商非零值的具体含义
- opcode: 操作码，0,1,2属于数据帧，8,9,10属于控制帧,具体含义如下
  - 0: 附加帧
  - 1: 文本帧
  - 2: 二进制帧
  - 3-7: 保留作为未来的非控制帧
  - 8: 关闭帧
  - 9: ping帧
  - 10: pong帧
  - 11-15: 保留作为未来的控制帧
- MASK: 掩码，0表示不使用掩码，1表示使用Masking-key对负载数据进行掩码运算
- Payload len: 
  - 0-125: 实际负载数据长度
  - 126: 接下来的两字节对应的无符号整数作为负载长度
  - 127: 扩展的8字节对应的无符号帧数作为负载长度
Masking-key: 如果MASK为1时，后续的四字节作为Masking-key，MASK为0时则缺省Masking-key
Payload Data: (x+y) bytes 负载数据
  - Extension data(x bytes): 扩展数据通常来说是0字节，除非协商了一个扩展
  - Application data(y bytes): 应用数据

解码操作代码如下：
```js
function decodeWsFrame(data) {
	// 游标
    let start = 0;
    // 定义帧字段格式
    let frame = {
        isFinal: (data[start] & 0x80) === 0x80,
        opcode: data[start++] & 0xF,
        masked: (data[start] & 0x80) === 0x80,
        payloadLen: data[start++] & 0x7F,
        maskingKey: '',
        payloadData: null
    };
    // 接下来的两字节对应的无符号整数作为负载长度
    if(frame.payloadLen === 126) {
        frame.payloadLen = (data[start++] << 8) + data[start++];
    } else if(frame.payloadLen === 127) { // 扩展的8字节对应的无符号帧数作为负载长度
        frame.payloadLen = 0;
        for(let i = 7; i >= 0; --i) {
            frame.payloadLen += (data[start++] << (i * 8));
        }
    }

    if(frame.payloadLen) {
    	// 如果使用了掩码
        if(frame.masked) {
        	// 掩码键
            const maskingKey = [
                data[start++],
                data[start++],
                data[start++],
                data[start++]
            ];

            frame.maskingKey = maskingKey;
            // 负载数据与四字节的掩码键的每一个字节轮流进行按位抑或运算
            frame.payloadData = data
                                .slice(start, start + frame.payloadLen)
                                .map((byte, idx) => byte ^ maskingKey[idx % 4]);
        } else {
            frame.payloadData = data.slice(start, start + frame.payloadLen);
        }
    }

    return frame;
}
```
解码数据帧结果
```js
/* 打印结果
{ isFinal: true,
  opcode: 0,
  masked: false,
  payloadLen: 3,
  maskingKey: '',
  payloadData: Buffer [68 65 6c 6c 6f 20 67 65 65 6d 6f] }
hello geemo
*/
socket.on('data', data => {
	data = decodeWsFrame(data); //数据帧解码
	console.log(data);  //打印帧
	console.log(String(data.payloadData)) //打印帧负载字符串格式结果
});
```

既然已经能解码客户端发送的帧后，我们接着来实现服务端编码帧响应回客户端。rfc文档中说服务端响应回客户端的帧不能进行掩码操作，那太好了！然而服务端虽然不需要考虑mask，但是还需要考虑分片问题。。。

```js
// 编码ws帧
function encodeWsFrame(data) {
    const isFinal = data.isFinal !== undefined ? data.isFinal : true, // 没有isFinal字段默认为终止帧
          opcode = data.opcode !== undefined ? data.opcode : 1, // 默认编码为文本帧
          payloadData = data.payloadData ? new Buffer(data.payloadData) : null,
          payloadLen = payloadData ? payloadData.length : 0;

    let frame = [];

    // 帧的第一个字节
    if(isFinal) frame.push((1 << 7) + opcode);
    else frame.push(opcode);

    // 帧的负载长度处理
    if(payloadLen < 126) {
        frame.push(payloadLen);
    } else if(payloadLen < 65536){
        frame.push(126, payloadLen >> 8, payloadLen & 0xFF);
    } else {
        frame.push(127);
        for(let i = 7; i >= 0; --i) {
            frame.push((payloadLen & (0xFF << (i * 8))) >> (i * 8));
        }
    }
    
    // 合并头部和负载数据
    frame = payloadData ? Buffer.concat([new Buffer(frame), payloadData]) : new Buffer(frame);

    console.dir(decodeWsFrame(frame));
    return frame;
}
```
最后是处理分片情况，所谓分片，就是一个完整数据分为多个数据帧进行发送，其可以分为三个部分:
- 起始帧(数量==1): FIN == 0, opcode != 0
- 附加帧(数量>=0): FIN == 0, opcode == 0
- 终止帧(数量==1): FIN == 1, opcode == 0

具体分片处理代码实现如下:

```js
function rawFrameParseHandle(socket) {
    let frame, 
        frameArr = [], // 用来保存分片帧的数组
        totalLen = 0;  // 记录所有分片帧负载叠加的总长度
    socket.on('data', rawFrame => {
        frame = decodeWsFrame(rawFrame);

        if(frame.isFinal) {
        	// 分片的终止帧
            if(frame.opcode === 0) {
                frameArr.push(frame);
                totalLen += frame.payloadLen;

                let frame = frameArr[0],
                    payloadDataArr = [];
                payloadDataArr = frameArr
                                    .filter(frame => frame.payloadData)
                                    .map(frame => frame.payloadData);
                // 将所有分片负载合并
                frame.payloadData = Buffer.concat(payloadDataArr);
                frame.payloadLen = totalLen;
                // 根据帧类型进行处理
                opHandle(socket, frame);
                frameArr = [];
                totalLen = 0;
            } else { // 普通帧
                opHandle(socket, frame);
            }
        } else { // 分片起始帧与附加帧
            frameArr.push(frame);
            totalLen += frame.payloadLen;
        }
    });
}
```
进行测试
```js
// 测试代码
socket.write(encodeWsFrame({isFinal: false, opcode: 1, payloadData: 'bbb'}));
socket.write(encodeWsFrame({isFinal: false, opcode: 0, payloadData: 'ccc'}));
socket.write(encodeWsFrame({isFinal: true, opcode: 0, payloadData: 'ddd'}));

// 客户端将三个帧进行拼接为'bbbcccddd'
```

**结尾**
好啦，大致实现基本完成，当然还有各种子协议，响应状态码等还没有研究，毕竟只是实现一个玩具嘛。