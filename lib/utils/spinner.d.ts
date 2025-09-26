export interface Spinner {
    start(text?: string): Spinner;
    stop(): Spinner;
    succeed(text?: string): Spinner;
    fail(text?: string): Spinner;
    text: string;
    isSpinning: boolean;
}
export declare function createSpinner(): Spinner;
export default createSpinner;
//# sourceMappingURL=spinner.d.ts.map