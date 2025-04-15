import chalk from 'chalk';

const icons = {
  info: '🔵',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  waiting: '⏳',
  screenshot: '📸'
};

const formatMessage = (icon, color, ...messages) => {
  const formattedMessage = messages.join(' ');
  return `${icon} ${chalk[color](formattedMessage)}`;
};

const logger = {
  info: (...args) => console.log(formatMessage(icons.info, 'blue', ...args)),
  success: (...args) => console.log(formatMessage(icons.success, 'green', ...args)),
  warning: (...args) => console.log(formatMessage(icons.warning, 'yellow', ...args)),
  error: (...args) => console.log(formatMessage(icons.error, 'red', ...args)),
  waiting: (...args) => console.log(formatMessage(icons.waiting, 'cyan', ...args)),
  screenshot: (...args) => console.log(formatMessage(icons.screenshot, 'magenta', ...args))
};

export default logger; 