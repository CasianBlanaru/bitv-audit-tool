const chalk = require('chalk');
const logSymbols = require('log-symbols');

const logger = {
  info: (message) => console.log(chalk.blue(logSymbols.info), chalk.blue(message)),
  success: (message) => console.log(chalk.green(logSymbols.success), chalk.green(message)),
  warning: (message) => console.log(chalk.yellow(logSymbols.warning), chalk.yellow(message)),
  error: (message) => console.log(chalk.red(logSymbols.error), chalk.red(message)),
  waiting: (message) => console.log(chalk.cyan('⏳'), chalk.cyan(message)),
  screenshot: (message) => console.log(chalk.magenta('📸'), chalk.magenta(message))
};

module.exports = logger; 