mailer
======

[![Dependency Status](https://www.versioneye.com/user/projects/56051afef5f2eb0019000ac2/badge.svg?style=flat)](https://www.versioneye.com/user/projects/56051afef5f2eb0019000ac2)

SSE 网站邮件发送服务，目前只支持对接一个邮件服务商。

## 依赖

- Node.js
- RabbitMQ
- Redis

## 说明

mailer 从 RabbitMQ 中取数据，发送邮件，再将发送情况记录到 Redis 中（记录的 TTL 为 5 天）。

> :scream: FIX ME：目前发送情况没有记录到 Redis 中，只输出在了控制台

## 参考配置

`config/config.yml`: 消息队列等配置

```yml
nick: "同济软院通知"
stdLogLevel: debug
mq:
  connection: amqp://guest:guest@localhost:5672
  queue:
    name: mail
    options:
      durable: true
      autoDelete: false
      maxPriority: 5
```

`config/accounts.yml`: 配置邮件发送账户，目前只支持指定一个账户

```yml
accounts:
  - tongji.1
```

如上配置文件中，指定了一个账户叫做 `tongji.1`，因此需要创建 `account.tongji.1.yml`，定义该账户具体配置：

`config/account.tongji.1.yml`: 

```yml
adapter: qq # 使用 qq 邮件服务用于测试，qq 邮件服务的定义在 adapter.qq.yml
user: 用户名
pass: 密码
```

该账户指定了使用邮件提供服务 `qq`，以下是该服务的参考配置：

`config/adapter.qq.yml`: 

```yml
serviceCode: QQex   # 预置了 QQex 模板，包含了 SMTP 的 IP 和端口等信息
limitations:
  - [ 1,      second  ]   # allow one request per second
  - [ 30,     minute  ]
  - [ 400,    hour    ]
  - [ 2000,   day     ]
```

目前暂不支持在 adapter 配置中自定义 SMTP 主机和端口，只能使用一个预置的模板配置。

## 邮件发送代码参考（PHP）

若要发送邮件，则将发送请求加入 RabbitMQ 队列。

以下是根据上文配置（exchange 名为 `sse`，queue 名为 `mail`，exchange->queue 的路由 key 为 `mail`）的范例代码（加入任务到队列）。

安装依赖：

```bash
composer require videlalvaro/php-amqplib
```

PHP：

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

function send($to, $subject, $html) {
    $connection = new \PhpAmqpLib\Connection\AMQPConnection('localhost', 5672, 'guest', 'guest');
    $channel = $connection->channel();
    $channel->exchange_declare(
        'sse',      // exchange name
        'direct',   // type
        false,      // passive
        true,       // durable
        false       // auto_delete
    );
    $channel->queue_declare(
        'mail',     // queue name
        false,      // passive
        true,       // durable
        false,      // exclusive
        false,      // auto_delete
        false,      // nowait
        new \PhpAmqpLib\Wire\AMQPTable([
            'x-max-priority' => 5
        ])
    );
    $channel->queue_bind('mail', 'sse', 'mail');
    $channel->basic_publish(new \PhpAmqpLib\Message\AMQPMessage(json_encode([
        'to' => $to,
        'subject' => $subject,
        'html' => $html,
    ]), [
        'delivery_mode' => 2,   // persistent
        'priority' => 5,        // priority
    ]), 'sse', 'mail');
    $channel->close();
    $connection->close();
}

send('hello@gmail.com', 'hello_world', '<b>hi!</b>');
// 往 hello@gmail.com 发送标题为 hello_world，HTML 内容为 <b>hi!</b> 的邮件，优先级最高
```