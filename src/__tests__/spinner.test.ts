import { createSpinner, Spinner } from '../utils/spinner.js';
import chalk from 'chalk';

// Mock process.stdout to capture output
const mockWrite = jest.fn();
const mockIsTTY = jest.fn();

// Store original methods
const originalWrite = process.stdout.write;
const originalIsTTY = process.stdout.isTTY;

// Mock console.log to capture success/fail messages
const mockConsoleLog = jest.fn();
const originalConsoleLog = console.log;

// Mock setTimeout and clearInterval for controlling timing
jest.useFakeTimers();

describe('Spinner', () => {
  let spinner: Spinner;

  beforeEach(() => {
    // Reset mocks
    mockWrite.mockClear();
    mockIsTTY.mockClear();
    mockConsoleLog.mockClear();
    
    // Reset mock implementations
    mockWrite.mockImplementation(() => true);
    mockIsTTY.mockReturnValue(true);
    mockConsoleLog.mockImplementation(() => {});

    // Mock process.stdout
    process.stdout.write = mockWrite;
    Object.defineProperty(process.stdout, 'isTTY', {
      get: mockIsTTY,
      configurable: true
    });

    // Mock console.log
    console.log = mockConsoleLog;

    // Create fresh spinner instance
    spinner = createSpinner();
  });

  afterEach(() => {
    // Stop any running spinners
    if (spinner.isSpinning) {
      spinner.stop();
    }

    // Restore original methods
    process.stdout.write = originalWrite;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true
    });
    console.log = originalConsoleLog;

    // Clear all timers
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('createSpinner', () => {
    it('should return a Spinner instance', () => {
      const spinner = createSpinner();
      expect(spinner).toBeDefined();
      expect(typeof spinner.start).toBe('function');
      expect(typeof spinner.stop).toBe('function');
      expect(typeof spinner.succeed).toBe('function');
      expect(typeof spinner.fail).toBe('function');
    });
  });

  describe('text property', () => {
    it('should have initial empty text', () => {
      expect(spinner.text).toBe('');
    });

    it('should update text property', () => {
      spinner.text = 'Loading...';
      expect(spinner.text).toBe('Loading...');
    });

    it('should re-render when text is updated while spinning', () => {
      spinner.start('Initial text');
      
      // Fast-forward to trigger at least one render
      jest.advanceTimersByTime(100);
      mockWrite.mockClear();

      spinner.text = 'Updated text';
      
      // Should have called write to update the display
      expect(mockWrite).toHaveBeenCalled();
    });

    it('should not render when text is updated while not spinning', () => {
      spinner.text = 'Some text';
      expect(mockWrite).not.toHaveBeenCalled();
    });
  });

  describe('isSpinning property', () => {
    it('should be false initially', () => {
      expect(spinner.isSpinning).toBe(false);
    });

    it('should be true when started', () => {
      spinner.start();
      expect(spinner.isSpinning).toBe(true);
    });

    it('should be false when stopped', () => {
      spinner.start();
      spinner.stop();
      expect(spinner.isSpinning).toBe(false);
    });
  });

  describe('start method', () => {
    it('should start spinning', () => {
      spinner.start();
      expect(spinner.isSpinning).toBe(true);
    });

    it('should set text when provided', () => {
      spinner.start('Loading data...');
      expect(spinner.text).toBe('Loading data...');
      expect(spinner.isSpinning).toBe(true);
    });

    it('should not start multiple intervals when called multiple times', () => {
      spinner.start();
      const firstCall = jest.getTimerCount();
      
      spinner.start();
      const secondCall = jest.getTimerCount();
      
      expect(secondCall).toBe(firstCall);
    });

    it('should return the spinner instance for chaining', () => {
      const result = spinner.start();
      expect(result).toBe(spinner);
    });

    it('should render spinner frames over time', () => {
      spinner.start('Testing...');
      
      // Initial render
      expect(mockWrite).toHaveBeenCalled();
      mockWrite.mockClear();
      
      // Advance time to trigger frame updates
      jest.advanceTimersByTime(80);
      expect(mockWrite).toHaveBeenCalled();
      
      mockWrite.mockClear();
      jest.advanceTimersByTime(80);
      expect(mockWrite).toHaveBeenCalled();
    });
  });

  describe('stop method', () => {
    it('should stop spinning', () => {
      spinner.start();
      spinner.stop();
      expect(spinner.isSpinning).toBe(false);
    });

    it('should clear the line when TTY is available', () => {
      mockIsTTY.mockReturnValue(true);
      spinner.start();
      spinner.stop();
      
      // Should have called write with clear line sequence
      const clearLineCalls = mockWrite.mock.calls.filter(call => 
        call[0].includes('\r\x1b[K')
      );
      expect(clearLineCalls.length).toBeGreaterThan(0);
    });

    it('should not write when TTY is not available', () => {
      mockIsTTY.mockReturnValue(false);
      spinner.start();
      mockWrite.mockClear();
      
      spinner.stop();
      
      // Should not have written anything for line clearing
      expect(mockWrite).not.toHaveBeenCalled();
    });

    it('should return the spinner instance for chaining', () => {
      spinner.start();
      const result = spinner.stop();
      expect(result).toBe(spinner);
    });

    it('should handle stopping when not spinning', () => {
      expect(() => spinner.stop()).not.toThrow();
      expect(spinner.isSpinning).toBe(false);
    });
  });

  describe('succeed method', () => {
    it('should stop spinning and show success message', () => {
      spinner.start('Processing...');
      spinner.succeed('Completed successfully');
      
      expect(spinner.isSpinning).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        chalk.green('✅'),
        'Completed successfully'
      );
    });

    it('should use current text if no message provided', () => {
      spinner.start('Processing...');
      spinner.succeed();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        chalk.green('✅'),
        'Processing...'
      );
    });

    it('should not log anything if no text and no message', () => {
      spinner.succeed();
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should return the spinner instance for chaining', () => {
      const result = spinner.succeed();
      expect(result).toBe(spinner);
    });
  });

  describe('fail method', () => {
    it('should stop spinning and show error message', () => {
      spinner.start('Processing...');
      spinner.fail('Failed to process');
      
      expect(spinner.isSpinning).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        chalk.red('❌'),
        'Failed to process'
      );
    });

    it('should use current text if no message provided', () => {
      spinner.start('Processing...');
      spinner.fail();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        chalk.red('❌'),
        'Processing...'
      );
    });

    it('should not log anything if no text and no message', () => {
      spinner.fail();
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should return the spinner instance for chaining', () => {
      const result = spinner.fail();
      expect(result).toBe(spinner);
    });
  });

  describe('spinner animation', () => {
    it('should cycle through spinner frames', () => {
      spinner.start('Testing frames...');
      
      const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      const writeCallsWithFrames: string[] = [];
      
      // Capture frames from multiple renders
      for (let i = 0; i < frames.length + 2; i++) {
        jest.advanceTimersByTime(80);
        
        // Find the most recent write call with a frame
        const recentCalls = mockWrite.mock.calls.slice(-5);
        const frameCall = recentCalls.find(call => 
          frames.some(frame => call[0].includes(frame))
        );
        
        if (frameCall) {
          const frameMatch = frames.find(frame => frameCall[0].includes(frame));
          if (frameMatch && !writeCallsWithFrames.includes(frameMatch)) {
            writeCallsWithFrames.push(frameMatch);
          }
        }
      }
      
      // Should have cycled through multiple frames
      expect(writeCallsWithFrames.length).toBeGreaterThan(3);
      
      // Should contain expected frames
      writeCallsWithFrames.forEach(frame => {
        expect(frames).toContain(frame);
      });
    });

    it('should include text in spinner output', () => {
      const testText = 'Loading important data...';
      spinner.start(testText);
      
      jest.advanceTimersByTime(80);
      
      // Should have written output containing the text
      const textOutputs = mockWrite.mock.calls.filter(call => 
        call[0].includes(testText)
      );
      expect(textOutputs.length).toBeGreaterThan(0);
    });
  });

  describe('multiple spinner instances', () => {
    it('should handle multiple independent spinners', () => {
      const spinner1 = createSpinner();
      const spinner2 = createSpinner();
      
      spinner1.start('Spinner 1');
      spinner2.start('Spinner 2');
      
      expect(spinner1.isSpinning).toBe(true);
      expect(spinner2.isSpinning).toBe(true);
      expect(spinner1.text).toBe('Spinner 1');
      expect(spinner2.text).toBe('Spinner 2');
      
      spinner1.stop();
      expect(spinner1.isSpinning).toBe(false);
      expect(spinner2.isSpinning).toBe(true);
      
      spinner2.stop();
    });
  });

  describe('error handling', () => {
    it('should handle write errors gracefully', () => {
      // Create a new spinner for this test to avoid affecting others
      const errorSpinner = createSpinner();
      
      mockWrite.mockImplementation(() => {
        throw new Error('Write error');
      });
      
      expect(() => {
        errorSpinner.start('Test');
        jest.advanceTimersByTime(80);
        errorSpinner.stop();
      }).not.toThrow();
    });
  });

  describe('method chaining', () => {
    it('should support method chaining', () => {
      const chainSpinner = createSpinner();
      
      expect(() => {
        chainSpinner
          .start('Initial')
          .stop()
          .succeed('Success');
      }).not.toThrow();
    });
  });
});
