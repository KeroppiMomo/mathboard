export class RecognitionParseError extends Error {
    constructor(message?: string, public json?: any) {
        super(message);

        Object.setPrototypeOf(this, RecognitionParseError.prototype); // Typescript, why????
    }
}

