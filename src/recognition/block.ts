import { Rect, Vector } from "../utils";
import { BlockInterface } from "./block-interface";
import { Parsers as $, Parsing } from "./helpers";
import { RecognitionParseError } from "./error";
import {Stroke} from "../stroke";

export type Block = BlockInterface;

export class UnsolvedBlock implements Block {
    id = crypto.randomUUID();
    boundingBox = Rect.zero;
    strokes: Stroke[] = [];

    get children() { return []; }

    *dfs() {
        yield this;
    }

    childResized(_: Block, __: Rect) {
        throw new Error("childResized is called but UnsolvedBlock has no children");
    }

    performDelete(_: WeakSet<Block>, target: WeakSet<Block>) {
        if (target.has(this)) {
            console.warn("Trying to delete an UnsolvedBlock");
        }
        return this;
    }
}

export class DeletedBlock implements Block {
    id = crypto.randomUUID();
    boundingBox = Rect.zero;
    strokes: Stroke[] = [];
    parent?: WeakRef<Block>;

    get children() { return []; }

    *dfs() {
        yield this;
    }

    childResized(_: Block, __: Rect) {
        throw new Error("childResized is called but DeletedBlock has no children");
    }

    performDelete(_: WeakSet<Block>, target: WeakSet<Block>) {
        if (target.has(this)) {
            console.warn("Trying to delete a DeletedBlock");
        }
        return this;
    }
}

export namespace Block { // Like it's static method of the interface Block
    export function parse(json: any): BlockInterface {
        if (json["error"] !== undefined) {
            if (json["error"] === "Unsolved") return new UnsolvedBlock();
        }
        const rawType = $.asType("string")(json, "type");
        const parser = Parsing.parsers.find((parser) => parser.parsedTypes.includes(rawType));
        if (parser === undefined)
            throw new RecognitionParseError(`Unknown block type "${json["type"]}"`, json);
        return parser.parse(json);
    }
}
