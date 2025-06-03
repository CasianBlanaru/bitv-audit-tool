import chalk from 'chalk';

class Logger {
  constructor() {
    this.spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.currentFrame = 0;
    this.interval = null;
  }

  /**
   * Start a spinner animation with a message
   * @param {string} message - The message to display
   */
  startSpinner(message) {
    this.stopSpinner(); // Stop any existing spinner
    
    process.stdout.write('\n');
    this.interval = setInterval(() => {
      process.stdout.write('\r' + chalk.cyan(this.spinnerFrames[this.currentFrame]) + ' ' + chalk.white(message));
      this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
    }, 100);
  }

  /**
   * Stop the current spinner
   */
  stopSpinner() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear the line
    }
  }

  /**
   * Display a success message
   * @param {string} message - The success message
   */
  success(message) {
    this.stopSpinner();
    console.log(chalk.green('✓ ') + chalk.white(message));
  }

  /**
   * Display an error message
   * @param {string} message - The error message
   */
  error(message) {
    this.stopSpinner();
    console.log(chalk.red('✗ ') + chalk.white(message));
  }

  /**
   * Display a warning message
   * @param {string} message - The warning message
   */
  warn(message) {
    this.stopSpinner();
    console.log(chalk.yellow('⚠ ') + chalk.white(message));
  }

  /**
   * Display an info message
   * @param {string} message - The info message
   */
  info(message) {
    this.stopSpinner();
    console.log(chalk.blue('ℹ ') + chalk.white(message));
  }

  /**
   * Display a progress update
   * @param {string} message - The progress message
   */
  progress(message) {
    this.stopSpinner();
    console.log(chalk.cyan('→ ') + chalk.white(message));
  }

  /**
   * Display the app header
   */
  header() {
    console.log();
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('                    BITV Audit Tool                          ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + chalk.gray('                Barrierefreiheits-Prüfung                    ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log();
  }

  /**
   * Display a completion summary
   * @param {Object} stats - Statistics object
   */
  summary(stats) {
    console.log();
    console.log(chalk.bold.white('📊 Audit Zusammenfassung:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    if (stats.totalChecks) {
      console.log(`${chalk.blue('Geprüfte Kriterien:')} ${chalk.white(stats.totalChecks)}`);
    }
    
    if (stats.totalErrors !== undefined) {
      const errorColor = stats.totalErrors === 0 ? chalk.green : stats.totalErrors < 5 ? chalk.yellow : chalk.red;
      console.log(`${chalk.blue('Gefundene Probleme:')} ${errorColor(stats.totalErrors)}`);
    }
    
    if (stats.duration) {
      console.log(`${chalk.blue('Dauer:')} ${chalk.white(stats.duration)}`);
    }
    
    if (stats.reportPath) {
      console.log(`${chalk.blue('Report:')} ${chalk.green(stats.reportPath)}`);
    }
    
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
  }

  /**
   * Create a progress bar
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {string} label - Progress label
   */
  progressBar(current, total, label = '') {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 30);
    const empty = 30 - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const progress = `[${bar}] ${percentage}% ${label}`;
    
    process.stdout.write('\r' + progress);
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }
}

// Create a singleton instance
const logger = new Logger();

export default logger; 