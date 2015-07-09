mailer
======

SSE 网站邮件发送服务，目前只支持对接一个邮件服务商。

## 依赖

- Node.js
- RabbitMQ
- Redis

## 说明

mailer 从 RabbitMQ 中取数据，发送邮件，再将发送情况记录到 Redis 中（记录的 TTL 为 5 天）

## 参考配置

`config/config.yml`: 消息队列等配置

```yml
nick: "同济软院通知"
stdLogLevel: debug
mq:
  connection:
    host: 127.0.0.1
  exchange:
    name: sse
    options:
      durable: true
      autoDelete: true
  queue:
    name: mail
    options:
      durable: true
      autoDelete: true
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
serviceCode: QQex
limitations:
  - [ 1,      second  ]   # allow one request per second
  - [ 30,     minute  ]
  - [ 400,    hour    ]
  - [ 2000,   day     ]
```