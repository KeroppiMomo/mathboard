import { Vector, Rect } from "../utils";
import { Stroke, StrokePoint } from "../stroke";
import { BlockInterface as Block } from "./block-interface";
import { RecognitionParseError } from "./error";

export function translateBlock(block: Block, ds: Vector) {
    for (const child of block.dfs()) {
        child.boundingBox.translate(ds);
        for (const stroke of child.strokes) {
            stroke.translate(ds);
        }
    }
}

type Parser<T> = (json: any, key: string) => T;
export namespace Parsers {
    const SCALE = 3.775

    export function ignoreNotFound<T>(parser: Parser<T>): Parser<T> {
        return (json: any, key: string) => {
            if (!json.hasOwnProperty(key)) throw AutoParse.skipFlag;
            return parser(json, key);
        };
    }

    export function assert<T>(parser: Parser<T>, condition: (val: T, json: any, key: string) => boolean, messageIfFailed?: string): Parser<T> {
        return (json: any, key: string) => {
            const res = parser(json, key);
            if (!condition(res, json, key))
                throw new RecognitionParseError(messageIfFailed || `Expect field ${key} to satisfy condition "${condition}" but found ${res} instead`, json);
            return res;
        }
    }
    export function assertVal<T>(parser: Parser<T>, val: T, messageIfFailed?: string): Parser<T> {
        return assert(parser, (res) => res === val, messageIfFailed);
    }

    export function asType(typeName: "string", messageIfFailed?: string): Parser<string>;
    export function asType(typeName: "number", messageIfFailed?: string): Parser<number>;
    export function asType(typeName: "boolean", messageIfFailed?: string): Parser<boolean>;
    export function asType(typeName: "object", messageIfFailed?: string): Parser<object>;
    export function asType(typeName: "undefined", messageIfFailed?: string): Parser<undefined>;
    export function asType(typeName: string, messageIfFailed?: string) {
        return (json: any, key: string) => {
            const val = json[key];
            if (typeof val !== typeName)
                throw new RecognitionParseError(messageIfFailed || `Expect field ${key} to have type ${typeName} but is ${json[key]} instead`, json);
            return val;
        };
    }

    export function toString(parser: Parser<{ toString: () => string }>): Parser<string> {
        return (json: any, key: string) => parser(json, key).toString();
    }
    export function toNumber(parser: Parser<string>): Parser<number> {
        return (json: any, key: string) => Number(parser(json, key));
    }

    export function asEnum<T extends string, TEnum>(enumType: { [key in T]: TEnum }, messageIfFailed?: string): Parser<TEnum> {
        const enumValues = Object.values(enumType);
        return (json: any, key: string) => {
            if (!enumValues.includes(json[key]))
                throw new RecognitionParseError(`Expect field ${key} to be an enum value but found ${json[key]} instead` || messageIfFailed, json);
            return json[key] as TEnum;
        };
    }

    export function asArray<T = any>(parser: (value: any, index: number, array: any[]) => T = (x) => x, messageIfFailed?: string): Parser<T[]> {
        return (json: any, key: string) => {
            const val = json[key];
            if (!(val instanceof Array))
                throw new RecognitionParseError(messageIfFailed || `Expect field ${key} to be an array but is ${json[key]} instead`, json);
            return (val as Array<any>).map(parser);
        };
    }

    export function asStrokeItems(json: any, key: string) {
        return asArray()(json, key).map((item) => {
            const parserNumArr = asArray((val: any): number => {
                if (typeof val !== "number")
                    throw new RecognitionParseError(`Expect values in field ${key} to be numbers but found ${val} instead`, json);
                return val;
            });

            const xs = parserNumArr(item, "X");
            const ys = parserNumArr(item, "Y");
            const ts = parserNumArr(item, "T");
            const fs = parserNumArr(item, "F");

            if (!([ ys.length, ts.length, fs.length ].every((x) => x == xs.length)))
                throw new RecognitionParseError(`Expect X, Y, T, F arrays in field ${key} to have equal lengths`, json);

            return new Stroke(xs.map((_, i) => new StrokePoint(xs[i], ys[i], ts[i], fs[i]).scaled(SCALE)));
        });
    }

    export function asRect(json: any, key: string): Rect {
        const x = asType("number")(json[key], "x");
        const y = asType("number")(json[key], "y");
        const w = asType("number")(json[key], "width");
        const h = asType("number")(json[key], "height");
        return new Rect(x, x+w, y, y+h).scaled(SCALE);
    }

}

export namespace Parsing {
    export type Parsable = {
        parse: (json: any) => Block,
        parsedTypes: string[],
    };

    export let parsers: Parsable[] = [];

    // Omg decorator
    export function registerParser<T extends Block, TClass extends {
        parse: (json: any) => T,
        parsedTypes: string[],
    }>(constructor: TClass): TClass {
        parsers.push(constructor);
        return constructor;
    }
}

// Fabulous generic types to get type from property decorator!
// https://stackoverflow.com/questions/47425088/strict-type-checking-for-property-type-with-property-decorator

/** Mark this property to be parsed from the json field with the same name by AutoParse. */
export function AutoParse<T>(parser: Parser<T>): <TClass extends Record<K, T>, K extends string>(target: TClass, prop: K) => void;
/** Mark this property to be parsed from the json field with the name `from` by AutoParse. */
export function AutoParse<T>(from: string, parser: Parser<T>): <TClass extends Record<K, T>, K extends string>(target: TClass, prop: K) => void;
export function AutoParse<T>(...args: (string | Parser<T>)[]) {
    const { from, parser } = (() => {
        if (args.length === 2) {
            return { from: args[0] as string, parser: args[1] as Parser<T> };
        } else {
            return { from: undefined, parser: args[0] as Parser<T> };
        }
    })();
    return function<TProto extends Record<K, T>, K extends string>(proto: TProto, prop: K) {
        // Warning: limited type check here
        let parsedFields: (AutoParse.Field<any> | undefined)[] = (proto as any)._parsedFields ?? [];
        parsedFields.push({
            from: from || prop,
            to: prop,
            parser: parser,
        });
        (proto as any)._parsedFields = parsedFields;
    }
}

export namespace AutoParse {
    export const fields: { [classSym: symbol]: string[] } = {};
    export const skipFlag = Symbol("AutoParse.skipFlag");

    export class AutoParseError extends Error {
        constructor(public index: number, message?: string) {
            super(message || `Field with constructor index ${index} not defined for auto parse`);
        }
    }

    export type Field<T> = {
        from: string,
        to: string, // tried using keyof, generic type isn't infered using usage of AutoParse
        parser: (json: any, key: string) => T,
    };

    export function parse<T extends Block, TClass extends (new (...args: any[]) => T) & {
        parsedTypes: string[],
        _parsedFields: (Field<any> | undefined)[],
    }>(json: any, constructor: TClass): T {
        const instance = new constructor();
        constructor._parsedFields.forEach((field, i) => {
            if (field === undefined)
                throw new AutoParseError(i);
            try {
                instance[field.to as keyof T] = field.parser(json, field.from);
            } catch (error) {
                if (error !== AutoParse.skipFlag) throw error;
            }
        });
        return instance;
    }

    export function mixin<T extends Block, TClass extends (new (...args: any[]) => T) & {
        parsedTypes: string[],
    }>(Base: TClass) {
        class AutoParsed extends Base {
            static readonly _parsedFields: (Field<any> | undefined)[] = Base.prototype._parsedFields ?? [];
            static parse(json: any): AutoParsed & InstanceType<TClass> {
                return parse(json, this as any); // give up making this sound
            }
        };
        return Parsing.registerParser(AutoParsed);
    }
}

export function AutoChildren<T extends Block | Block[] | undefined, TProto extends Record<K, T>, K extends string>(proto: TProto, prop: K) {
    // Warning: limited type check here
    let dfsFields: (keyof TProto)[] = (proto as any)._dfsFields ?? [];
    dfsFields.push(prop);
    (proto as any)._dfsFields = dfsFields;
}

export namespace AutoChildren {
    export function mixin<TClass extends new (...args: any[]) => Omit<Block, "children" | "dfs">>(Base: TClass) {
        class AutoChildrened extends Base implements Block {
            static readonly _dfsFields: (keyof AutoChildrened)[] = Base.prototype._dfsFields ?? [];

            get children() {
                const res: Block[] = [];
                for (const field of AutoChildrened._dfsFields) {
                    if (this[field] === undefined) {
                        // Do nothing
                    } else if (this[field] instanceof Array) {
                        res.push(...(this[field] as unknown as Block[]));
                    } else {
                        res.push(this[field] as unknown as Block);
                    }
                }
                return res;
            }

            *dfs(): IterableIterator<Block> {
                yield this;
                for (const child of this.children) {
                    yield* child.dfs();
                }
            }
        }

        return AutoChildrened;
    }
}
