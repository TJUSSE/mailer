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
var amqp = require('amqp');
var connection = amqp.createConnection(config.mq.connection);
debug('Connecting to RabbitMQ server...');

connection.on('ready', function () {
  info('Server connected.');
  // connect queue
  debug('Connecting to queue (queue name=%s, exchange name=%s)', config.mq.queue.name, config.mq.exchange.name);
  connection.queue(config.mq.queue.name, config.mq.queue.options, function (q) {
    // bind queue
    info('Queue connected.');
    q.bind(config.mq.exchange.name);
    info('Begin receiving messages...');
    // listen messages
    q.subscribe({ack: true}, function (message, headers, deliveryInfo, ack) {
      var id = ++messageId;
      var msg = {};
      try {
        msg = JSON.parse(message.data.toString());
      } catch (ignore) {
      }
      if (msg.to === undefined || msg.subject === undefined || msg.html === undefined) {
        ack.acknowledge();
        return;
      }
      debug('#%d\tREQ: to = %s, subject = %s, html = (omitted)', id, msg.to, msg.subject);
      transporter.send(config.nick, msg.to, msg.subject, msg.html, function (err, info) {
        if (err) {
          error('#%d\tRES Failed: %s', id, err.message);
        } else {
          debug('#%d\tRES: ', id, info);
        }
        // ack immedtaly after we sent a message
        ack.acknowledge();
      });
    });
  });
});