/**
 * Debug logging utility for development environment
 * Provides categorized logging that only outputs in development mode
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  category?: string;
  data?: unknown;
  force?: boolean; // Force logging even in production
}

class DebugLogger {
  private readonly isDevelopment: boolean;
  private enabledCategories: Set<string>;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    // Categories can be enabled/disabled via localStorage
    const stored = typeof window !== 'undefined' ?
      window.localStorage?.getItem('debug:categories') : null;
    this.enabledCategories = new Set(stored ? stored.split(',') : ['*']);
  }

  private shouldLog(category?: string, force?: boolean): boolean {
    if (force) return true;
    if (!this.isDevelopment) return false;
    if (!category) return true;
    return this.enabledCategories.has('*') || this.enabledCategories.has(category);
  }

  private formatMessage(_level: LogLevel, message: string, options?: LogOptions): string {
    const prefix = options?.category ? `[${options.category}]` : '';
    return `${prefix} ${message}`.trim();
  }

  debug(message: string, options?: LogOptions): void {
    if (this.shouldLog(options?.category, options?.force)) {
      const formatted = this.formatMessage('debug', message, options);
      // eslint-disable-next-line no-console
      console.log(formatted, options?.data !== undefined ? options.data : '');
    }
  }

  info(message: string, options?: LogOptions): void {
    if (this.shouldLog(options?.category, options?.force)) {
      const formatted = this.formatMessage('info', message, options);
      // eslint-disable-next-line no-console
      console.info(formatted, options?.data !== undefined ? options.data : '');
    }
  }

  warn(message: string, options?: LogOptions): void {
    if (this.shouldLog(options?.category, options?.force)) {
      const formatted = this.formatMessage('warn', message, options);
      // eslint-disable-next-line no-console
      console.warn(formatted, options?.data !== undefined ? options.data : '');
    }
  }

  error(message: string, options?: LogOptions): void {
    // Errors are always logged
    const formatted = this.formatMessage('error', message, options);
    // eslint-disable-next-line no-console
    console.error(formatted, options?.data !== undefined ? options.data : '');
  }

  /**
   * Enable or disable specific debug categories
   */
  setCategories(categories: string[]): void {
    this.enabledCategories = new Set(categories);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('debug:categories', categories.join(','));
    }
  }

  /**
   * Check if a category is enabled
   */
  isCategoryEnabled(category: string): boolean {
    return this.enabledCategories.has('*') || this.enabledCategories.has(category);
  }
}

// Create singleton instance
const logger = new DebugLogger();

// Export both the instance and convenience methods
export default logger;

export const debug = (message: string, options?: LogOptions) => logger.debug(message, options);
export const info = (message: string, options?: LogOptions) => logger.info(message, options);
export const warn = (message: string, options?: LogOptions) => logger.warn(message, options);
export const error = (message: string, options?: LogOptions) => logger.error(message, options);