declare module "pressure" {
    type SetClosure = {
        start?: (event: Event) => void,
        end?: () => void,
        startDeepPress?: (event: Event) => void,
        endDeepPress?: () => void,
        change?: (force: number, event: Event) => void,
        unsupported?: () => void,
    };
    type Options = {
        polyfill?: boolean,
        polyfillSpeedUp?: number,
        polyfillSpeedDown?: number,
        preventSelect?: boolean,
        only?: "touch" | "mouse" | "pointer",
    };

    export function set(
        selector: string | HTMLElement | HTMLElement[],
        closure: SetClosure,
        options?: Options,
    ): void;

    export function config(options: Options): void;

    export function map(inputValue: number, inputValueMin: number, inputValueMax: number, mapToMin: number, mapToMax: number): number;
}
