import chalk from 'chalk';
class SimpleSpinner {
    constructor() {
        this._text = '';
        this._isSpinning = false;
        this._interval = null;
        this._spinnerIndex = 0;
        this._spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    }
    get text() {
        return this._text;
    }
    set text(value) {
        this._text = value;
        if (this._isSpinning) {
            this._render();
        }
    }
    get isSpinning() {
        return this._isSpinning;
    }
    start(text) {
        if (text) {
            this._text = text;
        }
        if (!this._isSpinning) {
            this._isSpinning = true;
            this._startSpinning();
        }
        return this;
    }
    stop() {
        if (this._isSpinning) {
            this._isSpinning = false;
            if (this._interval) {
                clearInterval(this._interval);
                this._interval = null;
            }
            this._clearLine();
        }
        return this;
    }
    succeed(text) {
        this.stop();
        const message = text || this._text;
        if (message) {
            console.log(chalk.green('✅'), message);
        }
        return this;
    }
    fail(text) {
        this.stop();
        const message = text || this._text;
        if (message) {
            console.log(chalk.red('❌'), message);
        }
        return this;
    }
    _startSpinning() {
        this._interval = setInterval(() => {
            this._render();
            this._spinnerIndex = (this._spinnerIndex + 1) % this._spinnerFrames.length;
        }, 80);
    }
    _render() {
        if (!this._isSpinning)
            return;
        try {
            this._clearLine();
            const frame = this._spinnerFrames[this._spinnerIndex];
            process.stdout.write(`${chalk.cyan(frame)} ${this._text}`);
        }
        catch (error) {
            // Silently handle write errors to prevent spinner from crashing
        }
    }
    _clearLine() {
        try {
            if (process.stdout.isTTY) {
                process.stdout.write('\r\x1b[K');
            }
        }
        catch (error) {
            // Silently handle write errors to prevent spinner from crashing
        }
    }
}
export function createSpinner() {
    return new SimpleSpinner();
}
export default createSpinner;
//# sourceMappingURL=spinner.js.map