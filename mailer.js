/*global GLOBAL, debug, info, error */

// load configurations
var configLoader = require('./lib/configLoader.js');
var config = configLoader.loadYaml('config');
config.accounts = configLoader.loadYaml('accounts').accounts;
config.adapters = {};
config.accounts = config.accounts.map(function (name) {
  var content = configLoader.loadYaml('account.' + name);
  if (config.adapters[content.adapter] === undefined) {
    config.adapters[content.adapter] = configLoader.loadYaml('adapter.' + content.adapter);
  }
  return content;
});

// logger
var logger = require('./lib/logger.js')(config.stdLogLevel);
logger.expose(GLOBAL);

// create transporters
// 目前只支持一个 account
var transporter = require('./lib/transporter.js')(config.accounts, config.adapters);

var messageId = 0;

// listen message queue
var amqp = require('amqplib');
var open = amqp.connect(config.mq.connection);
debug('Connecting to RabbitMQ server...');

var ch;

open.then(function (connection) {
  info('Server connected.');
  return connection.createChannel();
}).then(function (channel) {
  info('Channel connected.');
  ch = channel;
  return ch.assertExchange(config.mq.exchange.name, config.mq.exchange.type, config.mq.exchange.options);
}).then(function () {
  info('Exchange declared, name = %s, type = %s, options = %j.', config.mq.exchange.name, config.mq.exchange.type, config.mq.exchange.options, {});
  return ch.assertQueue(config.mq.queue.name, config.mq.queue.options);
}).then(function () {
  info('Queue declared, name = %s, options = %j.', config.mq.queue.name, config.mq.queue.options, {});
  ch.bindQueue(config.mq.queue.name, config.mq.exchange.name, config.mq.binding.name);
  ch.prefetch(1);
  info('Accepting messages from queue \'%s\'...', config.mq.queue.name);
  ch.consume(config.mq.queue.name, function (msg) {
    var id = ++messageId;
    var data = {};
    try {
      data = JSON.parse(msg.content.toString());
    } catch (ignore) {
    }
    if (data.to === undefined || data.subject === undefined || data.html === undefined) {
      ch.ack(msg);
      return;
    }
    debug('#%d\tREQ: to = %s, subject = %s, html = (omitted)', id, data.to, data.subject);
    transporter.send(config.nick, data.to, data.subject, data.html, function (err, res) {
      if (err) {
        error('#%d\tRES Failed: %s', id, err.message);
      } else {
        debug('#%d\tRES: ', id, res);
      }
      ch.ack(msg);
    });
  }, { noAck: false });
});
