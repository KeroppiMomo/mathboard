import { Stroke, StrokePoint } from "../stroke";
import { Vector, Rect, Point } from "../utils";
import { AutoParse, AutoChildren, Parsers as $, Parsing, translateBlock } from "./helpers"; // yes dollar sign don't judge
import { Block, DeletedBlock, UnsolvedBlock } from "./block";


function AbstractBlock() {
    class _AbstractBlock {
        @AutoParse("items", $.ignoreNotFound($.asStrokeItems))
        strokes: Stroke[] = [];

        @AutoParse($.asType("string"))
        id = "";

        @AutoParse("bounding-box", $.asRect)
        boundingBox = Rect.zero;

        parent?: WeakRef<Block>;
    }
    return _AbstractBlock;
}

function AbstractOperandBlock(noOfOperands: number|undefined = undefined) {
    class _AbstractOperandBlock extends AbstractBlock() {
        @AutoParse($.assert($.asArray(Block.parse), (arr) => noOfOperands === undefined || arr.length === noOfOperands))
        @AutoChildren
        operands: Block[] = Array(noOfOperands).map(() => new UnsolvedBlock());
    }
    return _AbstractOperandBlock;
}

export const RecognitionResult = (() => {
    class _RecognitionResult {
        static readonly parsedTypes = ["Math"];

        static readonly _tag = Symbol("hello");

        @AutoParse($.assertVal($.toNumber($.asType("string")), 3))
        version = 3;

        @AutoParse($.ignoreNotFound($.asStrokeItems))
        strokes: Stroke[] = [];

        @AutoParse($.asType("string"))
        id = "";

        @AutoParse("bounding-box", $.asRect)
        boundingBox = Rect.zero;

        @AutoParse($.ignoreNotFound($.asArray(Block.parse)))
        @AutoChildren
        expressions: Block[] = [];

        childResized(_: Block, __: Rect) {
            this.boundingBox = new Rect(Infinity, -Infinity, Infinity, -Infinity);
            for (const expr of this.expressions) {
                this.boundingBox.expandWith(expr.boundingBox);
            }
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            if (target.has(this as any)) {
                console.warn("Trying to delete RecognitionResult");
                return new DeletedBlock();
            }

            const newExpressions = [];
            for (const exp of this.expressions) {
                if (!path.has(exp)) {
                    newExpressions.push(exp);
                    continue;
                }
                const newExp = exp.performDelete(path, target);
                if (!(newExp instanceof DeletedBlock)) {
                    newExpressions.push(newExp);
                }
            }

            this.boundingBox.maxX = this.boundingBox.minX;
            this.boundingBox.maxY = this.boundingBox.minY;

            this.expressions = newExpressions;
            for (const exp of this.expressions) {
                this.boundingBox.expandWith(exp.boundingBox);
            }

            return this as any;
        }
    };
    return AutoParse.mixin(AutoChildren.mixin(_RecognitionResult));
})();
export type RecognitionResult = InstanceType<typeof RecognitionResult>;


export const LeafBlock = (() => {
    enum Type { number = "number", symbol = "symbol" }
    class _LeafBlock extends AbstractBlock() {
        static readonly Type = Type;
        static readonly parsedTypes = Object.values(Type);

        @AutoParse($.asEnum(Type))
        type = _LeafBlock.Type.number;

        @AutoParse($.asType("string"))
        label = "";

        childResized(_: Block, __: Rect) {
            throw new Error("childResized is called but LeafBlock has no children");
        }

        performDelete(_: WeakSet<Block>, target: WeakSet<Block>): Block {
            if (target.has(this as any)) {
                const block = new DeletedBlock();
                block.parent = this.parent;
                return block;
            }
            return this as any;
        }
    };
    return AutoParse.mixin(AutoChildren.mixin(_LeafBlock));
})();
export type LeafBlock = InstanceType<typeof LeafBlock>;


export const GroupBlock = (() => {
    class _GroupBlock extends AbstractOperandBlock() {
        static readonly parsedTypes = ["group"];

        childResized(child: Block, oriRect: Rect) {
            const childIndex = this.operands.indexOf(child);
            if (childIndex == -1)
                throw new Error("childResized is called but GroupBlock cannot find the child");
            // Legend: * are operands, # is child, _ is space
            // Original:                     ***__####_____***___***
            // Case 1 (non-zero new size):   ***__######_____***___***
            // Case 2 (non-zero new size):   ***__##_____***___***
            // - Shift the later operands by (new size - old size)
            // Case 3 (zero new size):       ***_____***___***
            // - Take the new space to be maximum of the space before and after child
            // -> Shift the later operands by (-old size - min(space before, space after))
            const dx: number = (() => {
                if (child.boundingBox.minX == child.boundingBox.maxX) {
                    if (childIndex == 0) return this.boundingBox.minX - this.operands[1].boundingBox.minX;
                    const beforeSpace = oriRect.minX - this.operands[childIndex-1].boundingBox.maxX;
                    const afterSpace = (childIndex === this.operands.length-1) ? 0 : (this.operands[childIndex+1].boundingBox.minX - oriRect.maxX);
                    return -(oriRect.maxX - oriRect.minX) - Math.min(beforeSpace, afterSpace);
                } else {
                    return child.boundingBox.maxX - oriRect.maxX;
                }
            })();
            for (let i=childIndex+1; i < this.operands.length; ++i) {
                translateBlock(this.operands[i], new Vector(dx, 0));
            }
            this.operands.splice(childIndex, 1);
            const oriThisRect = this.boundingBox.clone();
            this.boundingBox.maxX = this.operands.at(-1)!.boundingBox.maxX;
            this.parent?.deref()?.childResized(this as any, oriThisRect);
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            if (target.has(this as any)) {
                console.warn("Trying to perform delete on GroupBlock");
                return new DeletedBlock();
            }

            const newChildren = [];

            let accDx = 0; // accumulated dx
            for (let i = 0; i < this.operands.length; ++i) {
                const child = this.operands[i];

                translateBlock(child, new Vector(accDx, 0));
                if (!(path.has(child) || target.has(child))) {
                    newChildren.push(child);
                    continue;
                }

                const oriRect = child.boundingBox.clone();
                const newChild = child.performDelete(path, target);

                const isChildDeleted = newChild instanceof DeletedBlock;
                const dx: number = (() => {
                    if (isChildDeleted) {
                        if (i == 0) return this.boundingBox.minX - this.operands[1].boundingBox.minX;
                        const beforeSpace = oriRect.minX - this.operands[i-1].boundingBox.maxX;
                        const afterSpace = (i === this.operands.length-1) ? 0 : (this.operands[i+1].boundingBox.minX - oriRect.maxX);
                        return -(oriRect.maxX - oriRect.minX) - Math.min(beforeSpace, afterSpace);
                    } else {
                        return newChild.boundingBox.maxX - oriRect.maxX;
                    }
                })();

                if (!isChildDeleted) newChildren.push(newChild);

                accDx += dx;
            }

            if (newChildren.length === 0) {
                const block = new DeletedBlock();
                block.parent = this.parent;
                return block;
            } else if (newChildren.length === 1) {
                newChildren[0].parent = this.parent;
                return newChildren[0];
            } else {
                this.operands = newChildren;

                this.boundingBox.maxX = this.boundingBox.minX;
                this.boundingBox.maxY = this.boundingBox.minY;
                for (const child of this.operands) {
                    this.boundingBox.expandWith(child.boundingBox);
                }

                return this as any;
            }
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_GroupBlock));
})();
export type GroupBlock = InstanceType<typeof GroupBlock>;


export const OperatorBlock = (() => {
    enum Type { add = "+", subtract = "-", multiply = "\u00d7" /* × */, slash = "/", divide = "\u00f7" /* ÷ */ }
    class _OperatorBlock extends AbstractBlock() {
        static readonly Type = Type;

        type = Type.add;

        @AutoChildren
        leftOperand: Block = new UnsolvedBlock();

        @AutoChildren
        rightOperand: Block = new UnsolvedBlock();

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            if (path.has(this.rightOperand)) {
                this.rightOperand = this.rightOperand.performDelete(path, target);
            }
            if (path.has(this.leftOperand)) {
                const oriRect = this.leftOperand.boundingBox.clone();
                this.leftOperand = this.leftOperand.performDelete(path, target);
                const dx = (() => {
                    if (this.leftOperand instanceof DeletedBlock) {
                        return this.boundingBox.minX - this.strokes.reduce((acc, cur) => Math.min(acc, cur.calBoundingBox().minX), Infinity);
                    } else {
                        return this.leftOperand.boundingBox.maxX - oriRect.maxX;
                    }
                })();
                this.strokes.forEach((stroke) => stroke.translate(new Vector(dx, 0)));
                translateBlock(this.rightOperand, new Vector(dx, 0));
            }

            const strokeBoundingBox = this.strokes.reduce((acc, cur) => acc.expandedWith(cur.calBoundingBox()), Rect.negInf);
            if (target.has(this as any)) {
                const dx = (() => {
                    if (this.leftOperand instanceof DeletedBlock) return this.boundingBox.minX - this.rightOperand.boundingBox.minX;
                    else return Math.max(this.leftOperand.boundingBox.maxX - strokeBoundingBox.maxX, strokeBoundingBox.minX - this.rightOperand.boundingBox.minX);
                })();
                console.log(dx);
                translateBlock(this.rightOperand, new Vector(dx, 0));

                const leftDeleted = this.leftOperand instanceof DeletedBlock;
                const rightDeleted = this.rightOperand instanceof DeletedBlock;
                if (leftDeleted && rightDeleted) return new DeletedBlock();
                else if (!leftDeleted && !rightDeleted) {
                    const block = new GroupBlock();
                    block.id = crypto.randomUUID();
                    block.boundingBox = this.leftOperand.boundingBox.expandedWith(this.rightOperand.boundingBox);
                    block.parent = this.parent;
                    block.operands = [this.leftOperand, this.rightOperand];
                    return block;
                } else if (leftDeleted) {
                    this.rightOperand.parent = this.parent;
                    return this.rightOperand;
                } else {
                    this.leftOperand.parent = this.parent;
                    return this.leftOperand;
                }
            } else {
                this.boundingBox = strokeBoundingBox;
                if (!(this.leftOperand instanceof DeletedBlock)) this.boundingBox.expandWith(this.leftOperand.boundingBox);
                if (!(this.rightOperand instanceof DeletedBlock)) this.boundingBox.expandWith(this.rightOperand.boundingBox);
                return this as any;
            }
        }
    }
    return AutoChildren.mixin(_OperatorBlock);
})();
export type OperatorBlock = InstanceType<typeof OperatorBlock>;
const OperatorParser: Parsing.Parsable = {
    parsedTypes: Object.values(OperatorBlock.Type),
    parse: (json: any) => {
        const id = $.asType("string")(json, "id");
        const strokes = $.asStrokeItems(json, "items");
        const boundingBox = $.asRect(json, "bounding-box");
        const type = $.asEnum(OperatorBlock.Type)(json, "type");

        const strokeBoundingBoxes = strokes
            .map((stroke) => ({ stroke: stroke, box: stroke.calBoundingBox() }))
            .sort((a,b) => a.box.midX - b.box.midX);
        const operands = $.asArray(Block.parse)(json, "operands");

        let stI = 0, opI = 0;
        let lastBlock: Block;
        if (strokeBoundingBoxes[stI].box.midX < operands[opI].boundingBox.midX) {
            lastBlock = new UnsolvedBlock();
        } else {
            lastBlock = operands[opI];
            opI++;
        }

        for (; opI < operands.length; ++opI) {
            const curBlock = new OperatorBlock();
            curBlock.id = `${id}/${opI}`;
            curBlock.leftOperand = lastBlock;
            curBlock.rightOperand = operands[opI];
            curBlock.boundingBox = lastBlock.boundingBox.expandedWith(operands[opI].boundingBox);
            curBlock.type = type;

            while (stI < strokeBoundingBoxes.length && strokeBoundingBoxes[stI].box.midX < operands[opI].boundingBox.midX) {
                curBlock.strokes.push(strokeBoundingBoxes[stI].stroke);
                curBlock.boundingBox.expandWith(strokeBoundingBoxes[stI].stroke.calBoundingBox());
                stI++;
            }

            lastBlock = curBlock;
        }

        if (stI < strokeBoundingBoxes.length) {
            const curBlock = new OperatorBlock();
            curBlock.id = `${id}/${operands.length}`;
            curBlock.leftOperand = lastBlock;
            curBlock.rightOperand = new UnsolvedBlock();
            curBlock.boundingBox = lastBlock.boundingBox;
            curBlock.type = type;

            while (stI < strokeBoundingBoxes.length) {
                curBlock.strokes.push(strokeBoundingBoxes[stI].stroke);
                curBlock.boundingBox.expandWith(strokeBoundingBoxes[stI].stroke.calBoundingBox());
                stI++;
            }

            lastBlock = curBlock;
        }

        return lastBlock;
    },
};
Parsing.registerParser(OperatorParser);


export const FractionBlock = (() => {
    class _FractionBlock extends AbstractOperandBlock(2) {
        static readonly parsedTypes = ["fraction"];

        get numerator() { return this.operands[0]; }
        set numerator(val: Block) { this.operands[0] = val; }

        get denominator() { return this.operands[1]; }
        set denominator(val: Block) { this.operands[1] = val; }

        childResized(child: Block, oriRect: Rect) {
            const oriThisRect = this.boundingBox.clone();

            const oriNuDenBox = (() => { // the original bounding box that contains numerator and denominator
                if (child === this.numerator) return this.denominator.boundingBox.expandedWith(oriRect);
                else if (child === this.denominator) return this.numerator.boundingBox.expandedWith(oriRect);
                else throw new Error("childResized is called but the child is not the numerator or denominator of FractionBlock");
            })();

            let dx = this.boundingBox.midX - child.boundingBox.midX;
            const maxAbsDx = Math.abs(child.boundingBox.width - oriRect.width);
            if (dx > maxAbsDx) dx = maxAbsDx;
            else if (dx < -maxAbsDx) dx = -maxAbsDx;
            translateBlock(child, new Vector(dx, 0));

            const nuDenBox = this.denominator.boundingBox.expandedWith(this.numerator.boundingBox);

            if (nuDenBox.minX < oriNuDenBox.minX) {
                // TODO extend the line
            } else if (nuDenBox.minX > oriNuDenBox.minX) {
                const cutoff = oriThisRect.minX + nuDenBox.minX - oriNuDenBox.minX;
                this.strokes = this.strokes.flatMap((stroke) => stroke.choppedVertical(">=", cutoff));
            }

            if (nuDenBox.maxX > oriNuDenBox.maxX) {
                // TODO extend the line
            } else if (nuDenBox.maxX < oriNuDenBox.maxX) {
                const cutoff = oriThisRect.maxX - (oriNuDenBox.maxX - nuDenBox.maxX);
                this.strokes = this.strokes.flatMap((stroke) => stroke.choppedVertical("<=", cutoff));
            }

            this.parent?.deref()?.childResized(this as any, oriThisRect);
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            if (target.has(this as any)) {
                // May change this decision later
                return new DeletedBlock();
            }

            const moveChild = (child: Block, oriRect: Rect) => {
                let dx = this.boundingBox.midX - child.boundingBox.midX;
                const maxAbsDx = Math.abs(child.boundingBox.width - oriRect.width);
                if (dx > maxAbsDx) dx = maxAbsDx;
                else if (dx < -maxAbsDx) dx = -maxAbsDx;
                translateBlock(child, new Vector(dx, 0));
            };

            const oriNuDenBox = this.numerator.boundingBox.expandedWith(this.denominator.boundingBox);

            if (path.has(this.numerator)) {
                const oriRect = this.numerator.boundingBox.clone();
                this.numerator = this.numerator.performDelete(path, target);
                moveChild(this.numerator, oriRect);
            }
            if (path.has(this.denominator)) {
                const oriRect = this.denominator.boundingBox.clone();
                this.denominator = this.denominator.performDelete(path, target);
                moveChild(this.denominator, oriRect);
            }

            const nuDenBox = this.denominator.boundingBox.expandedWith(this.numerator.boundingBox);

            if (nuDenBox.minX < oriNuDenBox.minX) {
                // TODO extend the line
            } else if (nuDenBox.minX > oriNuDenBox.minX) {
                const cutoff = this.boundingBox.minX + nuDenBox.minX - oriNuDenBox.minX;
                this.strokes = this.strokes.flatMap((stroke) => stroke.choppedVertical(">=", cutoff));
            }

            if (nuDenBox.maxX > oriNuDenBox.maxX) {
                // TODO extend the line
            } else if (nuDenBox.maxX < oriNuDenBox.maxX) {
                const cutoff = this.boundingBox.maxX - (oriNuDenBox.maxX - nuDenBox.maxX);
                this.strokes = this.strokes.flatMap((stroke) => stroke.choppedVertical("<=", cutoff));
            }

            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_FractionBlock));
})();
export type FractionBlock = InstanceType<typeof FractionBlock>;


// Not mentioned in documentation :/
export const MixedFractionBlock = (() => {
    class _MixedFractionBlock extends AbstractBlock() {
        static readonly parsedTypes = ["mixed"];

        @AutoParse("operands", (json: any, key: string) => {
            $.assert($.asArray(), (val) => val.length === 2)(json, key);
            return LeafBlock.parse((json[key] as Array<any>)[0])
        })
        @AutoChildren
        number: LeafBlock = new LeafBlock();

        @AutoParse("operands", (json: any, key: string) => FractionBlock.parse((json[key] as Array<any>)[1]))
        @AutoChildren
        fraction: FractionBlock = new FractionBlock();

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_MixedFractionBlock));
})();
export type MixedFractionBlock = InstanceType<typeof MixedFractionBlock>;

// Percentage, i hate you why would you do that
export const PercentageBlock = (() => {
    class _PercentageBlock extends AbstractBlock() {
        @AutoChildren
        operand: Block = new UnsolvedBlock();

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoChildren.mixin(_PercentageBlock);
})();
export type PercentageBlock = InstanceType<typeof PercentageBlock>;
const PercentageParser: Parsing.Parsable = {
    parsedTypes: ["percentage"],
    parse: (json: any) => {
        const id = $.asType("string")(json, "id");
        const strokes = $.asStrokeItems(json, "items");
        const boundingBox = $.asRect(json, "bounding-box");
        const operator = $.asEnum(OperatorBlock.Type)(json, "operator");
        const operands = $.assert($.asArray(Block.parse), (arr) => arr.length === 2)(json, "operands");

        const percentageBlock = new PercentageBlock();
        percentageBlock.id = id + "/percentage";
        percentageBlock.operand = operands[1];

        const operatorBlock = new OperatorBlock();
        operatorBlock.type = operator;
        operatorBlock.id = id + "/operator";
        operatorBlock.leftOperand = operands[0];
        operatorBlock.rightOperand = percentageBlock;
        operatorBlock.boundingBox = boundingBox;

        // Since it stupidly combines the operator and the percentage,
        // here is my way of separating the two sets of strokes:
        //
        // 1) Find the centre of operands[1]
        // 2) Strokes on the left of centre belong to the operator;
        //    and strokes on the right belong to the percentage sign.
        //
        // As for the bounding box of percentage block,
        // expand the bounding box of operands[1] with its strokes
        //
        // Holy crap it works, that concludes the parsing implementation yayyyyyyyyyyy bye now it's 00:32 17/3/2022 so sleep

        const midX = (operands[1].boundingBox.minX + operands[1].boundingBox.maxX)/2;
        const strokeBoundingBoxes = strokes.map((stroke) => stroke.calBoundingBox());
        percentageBlock.strokes = [];
        operatorBlock.strokes = [];
        percentageBlock.boundingBox = operands[1].boundingBox.clone();
        for (let i=0; i < strokes.length; ++i) {
            if (strokeBoundingBoxes[i].maxX < midX) operatorBlock.strokes.push(strokes[i]);
            else {
                percentageBlock.strokes.push(strokes[i]);
                percentageBlock.boundingBox.expandWith(strokeBoundingBoxes[i]);
            }
        }

        return operatorBlock;
    }
};
Parsing.registerParser(PercentageParser);

export const RootBlock = (() => {
    class _RootBlock extends AbstractBlock() {
        static readonly parsedTypes = ["square root"];

        @AutoParse("operands", (json: any, key: string) => {
            if ((json[key] as Array<any>).length === 1) return undefined;
            else return Block.parse((json[key] as Array<any>)[0]);
        })
        @AutoChildren
        exponent: Block | undefined = new UnsolvedBlock();

        @AutoParse("operands", (json: any, key: string) => {
            $.assert($.asArray(), (arr) => arr.length === 1 || arr.length === 2);
            return Block.parse((json[key] as Array<any>).at(-1));
        })
        @AutoChildren
        operand: Block = new UnsolvedBlock();

        childResized(child: Block, oriRect: Rect) {
            if (child === this.exponent) {
                // If the exponent size is "small enough" (e.g. the number "3", a single symbol "x"), then don't move the radical part
                // Otherwise (e.g. an entire expression "ln x"), then shift left for some amount
                // I let the "reference width" for the "small enough" condition to be (height of radical/3)
                // Conclusion: treat the exponent to have minimum width of the "reference width"
                const referenceWidth = this.boundingBox.height/3;
                const treatedOriWidth = Math.max(referenceWidth, oriRect.width);
                const treatedNewWidth = Math.max(referenceWidth, child.boundingBox.width);

                const oriThisRect = this.boundingBox.clone();
                this.boundingBox = new Rect(Infinity, -Infinity, Infinity, -Infinity);

                const dx = treatedNewWidth - treatedOriWidth;

                for (const stroke of this.strokes) {
                    stroke.translate(new Vector(dx, 0));
                    this.boundingBox.expandWith(stroke.calBoundingBox());
                }

                translateBlock(this.operand, new Vector(dx, 0));
                this.boundingBox.expandWith(this.operand.boundingBox);

                const expDx = oriRect.maxX + dx - child.boundingBox.maxX;
                translateBlock(child, new Vector(expDx, 0));
                this.boundingBox.expandWith(child.boundingBox);

                this.parent?.deref()?.childResized(this as any, oriThisRect);
            } else if (child === this.operand) {
                if (child.boundingBox.maxX < oriRect.maxX) {
                    const cutoff = this.boundingBox.maxX + (child.boundingBox.maxX - oriRect.maxX);
                    this.strokes = this.strokes.flatMap((stroke) => stroke.choppedVertical("<=", cutoff));
                } else {
                }
            } else {
                throw new Error("childResized but child is not operand or exponent of RootBlock");
            }
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_RootBlock));
})();
export type RootBlock = InstanceType<typeof RootBlock>;

export const RelationBlock = (() => {
    // LaTeX naming convention
    enum Type {
        equal = "=",
        greater = ">",
        less = "<",
        approx = "\u2248", // ≈
        neq = "\u2260", // ≠
        equiv = "\u2261", // ≡
        notEquiv = "\u2262", // ≢
        leq = "\u2264", // ≤
        geq = "\u2265", // ≥
        ll = "\u226a", // ≪
        gg = "\u226b", // ≫
        leftArrow = "\u21d0", // ⇐
        rightArrow = "\u21d2", // ⇒
        leftRightArrow = "\u21d4", // ⇔
        parallel = "\u2225", // ∥
    }
    class _RelationBlock extends AbstractOperandBlock(2) {
        static readonly Type = Type;
        static readonly parsedTypes = Object.values(Type);

        @AutoParse($.asEnum(Type))
        type = Type.equal;

        get leftOperand() { return this.operands[0]; }
        set leftOperand(val: Block) { this.operands[0] = val; }

        get rightOperand() { return this.operands[1]; }
        set rightOperand(val: Block) { this.operands[1] = val; }

        childResized(child: Block, oriRect: Rect) {
            if (child === this.leftOperand) {
                const dx = this.leftOperand.boundingBox.maxX - oriRect.maxX;
                for (const stroke of this.strokes) {
                    for (const vertex of stroke.vertices) {
                        vertex.x += dx;
                    }
                }
                for (const block of this.rightOperand.dfs()) {
                    translateBlock(block, new Vector(dx, 0));
                }
            }

            const thisOriRect = this.boundingBox.clone();
            this.boundingBox = this.leftOperand.boundingBox.expandedWith(child.boundingBox);
            for (const stroke of this.strokes) {
                this.boundingBox.expandWith(stroke.calBoundingBox());
            }

            this.parent?.deref?.()?.childResized(this as any, thisOriRect);
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_RelationBlock));
})();
export type RelationBlock = InstanceType<typeof RelationBlock>;


// Okay let me explain
// This is to avoid duplicating code in subsuperscript, underoverscript, and presubsuperscript.
// The order of the parts appearing in `operands` is, for example,
// Subscript only:      [ script, subscript ]
// Superscript only:    [ script, superscript ]
// Subsuperscript:      [ script, subscript, superscript ]
//            this goes first ------^             ^------ this goes last
// So I call subscript "first-appear script", superscript "last-appear script", and subsuperscript "both script"
//
// Good? Please continue to deal with the wrong jiix documentation thanks

function scriptParser(...bothScriptNames: string[]) {
    return (json: any, key: string) => {
        $.assert($.asArray(), (val) => {
            if (bothScriptNames.includes(json.type)) return val.length === 3;
            else return val.length === 2;
        })(json, key);
        return Block.parse(json[key][0]);
    };
}
function firstAppearScriptParser(...lastAppearNames: string[]) {
    return (json: any, key: string) => {
        if (lastAppearNames.includes(json.type)) return undefined;
        else return Block.parse((json[key] as Array<any>)[1]);
    };
}
function lastAppearScriptParser(...firstAppearNames: string[]) {
    return (json: any, key: string) => {
        if (firstAppearNames.includes(json.type)) return undefined;
        else return Block.parse((json[key] as Array<any>).at(-1))
    };
}

export const SubsuperscriptBlock = (() => {
    enum Type { super = "superscript", sub = "subscript", subsuper = "subsuperscript" }
    class _SubsuperscriptBlock extends AbstractBlock() {
        static readonly Type = Type;
        static readonly parsedTypes = [...Object.values(Type), "power"];

        @AutoParse((json: any, key: string) => {
            if (json[key] === "power") return Type.super;
            else return $.asEnum(Type)(json, key);
        })
        type = Type.sub;

        @AutoParse("operands", scriptParser(Type.subsuper))
        @AutoChildren
        script: Block = new UnsolvedBlock();

        @AutoParse("operands", firstAppearScriptParser(Type.super, "power"))
        @AutoChildren
        subscript: Block | undefined = new UnsolvedBlock();

        @AutoParse("operands", lastAppearScriptParser(Type.sub))
        @AutoChildren
        superscript: Block | undefined = new UnsolvedBlock();

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_SubsuperscriptBlock));
})();
export type SubsuperscriptBlock = InstanceType<typeof SubsuperscriptBlock>;


export const UnderoverscriptBlock = (() => {
    enum Type { under = "underscript", over = "overscript", underover = "underoverscript" }
    class _UnderoverscriptBlock extends AbstractBlock() {
        static readonly Type = Type;
        static readonly parsedTypes = Object.values(Type);

        @AutoParse($.asEnum(Type))
        type = Type.under;

        @AutoParse("operands", scriptParser(Type.underover))
        @AutoChildren
        script: Block = new UnsolvedBlock();

        @AutoParse("operands", firstAppearScriptParser(Type.over))
        @AutoChildren
        underscript: Block | undefined = new UnsolvedBlock();

        @AutoParse("operands", lastAppearScriptParser(Type.under))
        @AutoChildren
        overscript: Block | undefined = new UnsolvedBlock();

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_UnderoverscriptBlock));
})();
export type UnderoverscriptBlock = InstanceType<typeof UnderoverscriptBlock>;


export const PresubsuperscriptBlock = (() => {
    enum Type { super = "presuperscript", sub = "presubscript", subsuper = "presubsuperscript" }
    class _PresubsuperscriptBlock extends AbstractBlock() {
        static readonly Type = Type;
        static readonly parsedTypes = Object.values(Type);

        @AutoParse($.asEnum(Type))
        type = Type.sub;

        @AutoParse("operands", scriptParser(Type.subsuper))
        @AutoChildren
        script: Block = new UnsolvedBlock();

        @AutoParse("operands", firstAppearScriptParser(Type.super))
        @AutoChildren
        presubscript: Block | undefined = new UnsolvedBlock();

        @AutoParse("operands", lastAppearScriptParser(Type.sub))
        @AutoChildren
        presuperscript: Block | undefined = new UnsolvedBlock();

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_PresubsuperscriptBlock));
})();
export type PresubsuperscriptBlock = InstanceType<typeof PresubsuperscriptBlock>;


export const SystemBlock = (() => {
    class _SystemBlock extends AbstractBlock() {
        static readonly parsedTypes = ["system"];

        @AutoParse($.asArray(Block.parse))
        @AutoChildren
        expressions: Block[] = [];

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_SystemBlock));
})();
export type SystemBlock = InstanceType<typeof SystemBlock>;


export const MatrixBlock = (() => {
    class _MatrixBlock extends AbstractBlock() implements Block {
        static readonly parsedTypes = ["matrix"];

        @AutoParse("rows", $.asArray((val) => $.asArray(Block.parse)(val, "cells")))
        cells: Block[][] = [];

        get children(): Block[] {
            const res: Block[] = [];
            for (const rows of this.cells)
                res.push(...rows);
            return res;
        }

        *dfs(): IterableIterator<Block> {
            yield this;
            for (const child of this.children)
                yield* child.dfs();
        }

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }

    return AutoParse.mixin(_MatrixBlock);
})();
export type MatrixBlock = InstanceType<typeof MatrixBlock>


// Skipped rows cuz i can't recreate it

export const FunctionBlock = (() => {
    class _FunctionBlock extends AbstractOperandBlock(1) {
        static readonly parsedTypes = ["function"];

        @AutoParse($.asType("string"))
        label = "";

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_FunctionBlock));
})();
export type FunctionBlock = InstanceType<typeof FunctionBlock>


export const FenceBlock = (() => {
    class _FenceBlock extends AbstractBlock() {
        static readonly parsedTypes = ["fence"];

        @AutoParse("operands", (json: any, key: string) => $.assert($.asArray(Block.parse), (arr) => arr.length === 1)(json, key)[0])
        @AutoChildren
        operand: Block = new UnsolvedBlock();

        @AutoParse<string|undefined>("open symbol", $.ignoreNotFound($.asType("string")))
        openSymbol: string | undefined;

        @AutoParse<string|undefined>("close symbol", $.ignoreNotFound($.asType("string")))
        closeSymbol: string | undefined;

        childResized(child: Block, oriRect: Rect) {
            // TODO
        }

        performDelete(path: WeakSet<Block>, target: WeakSet<Block>): Block {
            // TODO
            return this as any;
        }
    }
    return AutoParse.mixin(AutoChildren.mixin(_FenceBlock));
})();
export type FenceBlock = InstanceType<typeof FenceBlock>;
