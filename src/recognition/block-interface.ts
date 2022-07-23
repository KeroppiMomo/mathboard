import { Stroke } from "../stroke";
import { Rect } from "../utils";

export interface BlockInterface {
    id: string;
    boundingBox: Rect;
    strokes: Stroke[];

    get children(): BlockInterface[];
    parent?: WeakRef<BlockInterface>; // Wow WeakRef

    // Also yield `this` please
    dfs(): IterableIterator<BlockInterface>;

    childResized(child: BlockInterface, oriRect: Rect): void;
    performDelete(path: WeakSet<BlockInterface>, target: WeakSet<BlockInterface>): BlockInterface;
}

