export class Logger {
    private prefix: string;

    constructor(prefix: string = 'AI Note') {
        this.prefix = `[${prefix}]`;
    }

    info(message: string, ...args: unknown[]): void {
        console.log(`${this.prefix} INFO:`, message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(`${this.prefix} WARN:`, message, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        console.error(`${this.prefix} ERROR:`, message, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        console.debug(`${this.prefix} DEBUG:`, message, ...args);
    }
}
