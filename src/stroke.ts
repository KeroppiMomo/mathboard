import * as p5 from "p5";
import { Clonable, Point, Rect, Vector } from "./utils";

export class StrokePoint extends Point implements Clonable<StrokePoint> {
    constructor(public x: number, public y: number, public t: number, public p: number) {
        super(x, y);
    }

    scaled(mul: number): StrokePoint {
        return new StrokePoint(this.x * mul, this.y * mul, this.t, this.p);
    }

    clone() {
        return new StrokePoint(this.x, this.y, this.t, this.p);
    }
}
export class Stroke implements Clonable<Stroke> {
    pendingDeletion: boolean = false;

    constructor(public vertices: StrokePoint[] = []) {}

    // Computation

    calBoundingBox() {
        const rect = new Rect(Infinity, -Infinity, Infinity, -Infinity);
        for (const vertex of this.vertices) {
            rect.minX = Math.min(rect.minX, vertex.x);
            rect.maxX = Math.max(rect.maxX, vertex.x);
            rect.minY = Math.min(rect.minY, vertex.y);
            rect.maxY = Math.max(rect.maxY, vertex.y);
        }
        return rect;
    }

    translate(ds: Vector) {
        for (const vertex of this.vertices) {
            vertex.x += ds.x;
            vertex.y += ds.y;
        }
    }

    clone() {
        const cloned = new Stroke();
        cloned.pendingDeletion = this.pendingDeletion;
        cloned.vertices = this.vertices.map((v) => v.clone());
        return cloned;
    }

    // Drawing

    draw(sketch: p5, pressureToWeight: (p: number) => number | undefined = (p) => p*8+2) {
        if (this.vertices.length == 0) return;
        for (let i=0; i < this.vertices.length-1; ++i) {
            // control, vertex
            const ctl1 = this.vertices[Math.max(0, i-1)];
            const vtx1 = this.vertices[i];
            const vtx2 = this.vertices[i+1];
            const ctl2 = this.vertices[Math.min(this.vertices.length-1, i+2)];
            const p = pressureToWeight(vtx1.p);
            if (p !== undefined) sketch.strokeWeight(p);
            sketch.curve(ctl1.x, ctl1.y, vtx1.x, vtx1.y, vtx2.x, vtx2.y, ctl2.x, ctl2.y);
        }
        // sketch.beginShape();
        // sketch.curveVertex(this.vertices[0].x, this.vertices[0].y);
        // for (const v of this.vertices) {
        //     sketch.curveVertex(v.x, v.y);
        // }
        // sketch.curveVertex(this.vertices.at(-1)!.x, this.vertices.at(-1)!.y);
        // sketch.endShape();
    }

    // Algorithms

    // Chopping: keeping parts of the stroke which satisfy certain criteria, dumping the other parts
    //
    // For example, I want to do this:
    // stroke.vertices = stroke.vertices.filter((vertex) => vertex.x >= cutoff);
    // but if the number of vertices is small, the stroke will not terminate at x=cutoff after filtering, like this:
    // legend: vertex x, line -, cutoff |
    // before: x------x----|-----x-------x
    // after:                    x-------x
    // So I need to add a point when the line crosses the cutoff, like this:
    // better:             x-----x-------x
    //      crossing point ^

    chopped(getCrossingPoint: (kept: StrokePoint, dumped: StrokePoint) => StrokePoint, isKeeping: (v: StrokePoint) => boolean): Stroke[] {
        const res: Stroke[] = [];

        let i = 0; // point to next index to be processed
        while (true) {
            const newStroke = this.clone();
            newStroke.vertices = [];

            // Please accept these two shorthands
            const thisVs = this.vertices;
            const newVs = newStroke.vertices;

            if (i === thisVs.length) return res;

            // Get the first point into newVertices
            if (isKeeping(thisVs[i])) {
                newStroke.vertices.push(thisVs[i]);
                ++i;
            } else {
                while (i < thisVs.length && !isKeeping(thisVs[i])) {
                    ++i;
                }
                if (i === thisVs.length) return res;
                newVs.push(getCrossingPoint(thisVs[i-1], thisVs[i]));
            }

            for (; i < thisVs.length; ++i) {
                const cur = thisVs[i];
                if (isKeeping(cur)) {
                    newVs.push(cur);
                } else {
                    newVs.push(getCrossingPoint(thisVs.at(-1)!, cur));
                    break;
                }
            }

            res.push(newStroke);
        }
    }

    choppedVertical(keepWhen: ">" | ">=" | "<" | "<=", xCutoff: number) {
        function getPointOnLineWithX(v1: Point, v2: Point, x: number): Point {
            if (v1.x === v2.x) {
                if (v1.y === v2.y) return v1;
                else throw new Error("Cannot getPointOnLineWithX when the line is vertical");
            }
            const m = (v2.y - v1.y)/(v2.x - v1.x);
            return new Point(x, m*(x-v1.x) + v1.y);
        }
        function getCrossingPoint(v1: StrokePoint, v2: StrokePoint): StrokePoint {
            const point = getPointOnLineWithX(v1, v2, xCutoff);
            return new StrokePoint(point.x, point.y, (v1.t + v2.t)/2, (v1.p + v2.p)/2);
        }
        const isKeeping: (v: StrokePoint) => boolean = {
            ">":  (v: StrokePoint) => v.x > xCutoff,
            ">=": (v: StrokePoint) => v.x >= xCutoff,
            "<":  (v: StrokePoint) => v.x < xCutoff,
            "<=": (v: StrokePoint) => v.x <= xCutoff,
        }[keepWhen];

        return this.chopped(getCrossingPoint, isKeeping);
    }
}
