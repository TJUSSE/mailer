var nodemailer = require('nodemailer');
var RateLimiter = require('limiter').RateLimiter;

var transporters = [];

var out = {
  send: function (senderNick, to, subject, html, callback) {
    // helper function to recursively remove token
    var removeToken = function (index, callback) {
      transporters[0].limiters[index].removeTokens(1, function () {
        if (index + 1 < transporters[0].limiters.length) {
          removeToken(index + 1, callback);
        } else {
          callback && callback();
        }
      });
    };
    removeToken(0, function () {
      var options = {
        from: senderNick + ' <' + transporters[0].user + '>',
        to: to,
        subject: subject,
        html: html
      };
      transporters[0].transporter.sendMail(options, callback);
    });
  }
};

var init = function (accounts, adapters) {
  if (accounts.length > 1) {
    warn('Multiple accounts in configuration file. Only the first account (%s) will be used.', accounts[0].user);
  }
  if (accounts.length === 0) {
    error('At least one account should be specified.');
  }
  accounts.forEach(function (account) {
    // create rate limiters
    var limiters = [];
    adapters[account.adapter].limitations.forEach(function (rule) {
      limiters.push(new RateLimiter(rule[0], rule[1]));
    });

    // create transport object
    var transporter = nodemailer.createTransport({
      service: adapters[account.adapter].serviceCode,
      auth: {
        user: account.user,
        pass: account.pass
      }
    });

    // add transporter
    transporters.push({
      user: account.user,
      limiters: limiters,
      transporter: transporter
    });
  });

  return out;
};

module.exports = init;