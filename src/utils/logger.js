import chalk from 'chalk';
import logSymbols from 'log-symbols';

const icons = {
  info: '🔵',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  waiting: '⏳',
  screenshot: '📸'
};

const logger = {
  info: (message) => console.log(icons.info, chalk.blue(message)),
  success: (message) => console.log(icons.success, chalk.green(message)),
  warning: (message) => console.log(icons.warning, chalk.yellow(message)),
  error: (message) => console.log(icons.error, chalk.red(message)),
  waiting: (message) => console.log(icons.waiting, chalk.cyan(message)),
  screenshot: (message) => console.log(icons.screenshot, chalk.magenta(message))
};

export default logger; 