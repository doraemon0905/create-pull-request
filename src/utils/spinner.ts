import chalk from 'chalk';

export interface Spinner {
  start(text?: string): Spinner;
  stop(): Spinner;
  succeed(text?: string): Spinner;
  fail(text?: string): Spinner;
  text: string;
  isSpinning: boolean;
}

class SimpleSpinner implements Spinner {
  private _text: string = '';
  private _isSpinning: boolean = false;
  private _interval: NodeJS.Timeout | null = null;
  private _spinnerIndex: number = 0;
  private _spinnerFrames: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  get text(): string {
    return this._text;
  }

  set text(value: string) {
    this._text = value;
    if (this._isSpinning) {
      this._render();
    }
  }

  get isSpinning(): boolean {
    return this._isSpinning;
  }

  start(text?: string): Spinner {
    if (text) {
      this._text = text;
    }
    
    if (!this._isSpinning) {
      this._isSpinning = true;
      this._render(); // Initial render
      this._startSpinning();
    }
    
    return this;
  }

  stop(): Spinner {
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

  succeed(text?: string): Spinner {
    this.stop();
    const message = text || this._text;
    if (message) {
      console.log(chalk.green('✅'), message);
    }
    return this;
  }

  fail(text?: string): Spinner {
    this.stop();
    const message = text || this._text;
    if (message) {
      console.log(chalk.red('❌'), message);
    }
    return this;
  }

  private _startSpinning(): void {
    this._interval = setInterval(() => {
      this._render();
      this._spinnerIndex = (this._spinnerIndex + 1) % this._spinnerFrames.length;
    }, 80);
  }

  private _render(): void {
    if (!this._isSpinning) return;
    
    try {
      this._clearLine();
      const frame = this._spinnerFrames[this._spinnerIndex];
      process.stdout.write(`${chalk.cyan(frame)} ${this._text}`);
    } catch (error) {
      // Silently handle write errors to prevent crashes
    }
  }

  private _clearLine(): void {
    try {
      if (process.stdout.isTTY) {
        process.stdout.write('\r\x1b[K');
      }
    } catch (error) {
      // Silently handle write errors to prevent crashes
    }
  }
}

export function createSpinner(): Spinner {
  return new SimpleSpinner();
}

export default createSpinner;
