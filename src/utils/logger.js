const chalk = require('chalk');
const logSymbols = require('log-symbols');

class Logger {
  static info(message) {
    console.log(chalk.blue(logSymbols.info), chalk.blue(message));
  }

  static success(message) {
    console.log(chalk.green(logSymbols.success), chalk.green(message));
  }

  static warning(message) {
    console.log(chalk.yellow(logSymbols.warning), chalk.yellow(message));
  }

  static error(message) {
    console.log(chalk.red(logSymbols.error), chalk.red(message));
  }

  static waiting(message) {
    console.log(chalk.cyan('⏳'), chalk.cyan(message));
  }

  static screenshot(message) {
    console.log(chalk.magenta('📸'), chalk.magenta(message));
  }
}

module.exports = Logger; 