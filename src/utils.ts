export interface Clonable<T> {
    clone(): T;
}

export class Point implements Clonable<Point> {
    constructor(public x: number, public y: number) {}

    // You can't add two points together, can you :D
    add(vec: Vector) {
        this.x += vec.x;
        this.y += vec.y;
    }

    scaled(mul: number): Point {
        return new Point(this.x * mul, this.y * mul);
    }

    scale(mul: number): void {
        this.x *= mul;
        this.y *= mul;
    }

    clone() {
        return new Point(this.x, this.y);
    }
}

// :O
export const Vector = Point;
export type Vector = InstanceType<typeof Vector>;

export class Rect implements Clonable<Rect> {
    constructor(public minX: number, public maxX: number, public minY: number, public maxY: number) {}

    static readonly zero = new Rect(0,0,0,0);
    static readonly inf = new Rect(-Infinity, Infinity, -Infinity, Infinity);
    static readonly negInf = new Rect(Infinity, -Infinity, Infinity, -Infinity);

    get width(): number { return this.maxX - this.minX; }
    get height(): number { return this.maxY - this.minY; }

    get midX(): number { return (this.minX + this.maxX)/2; }
    get midY(): number { return (this.minY + this.maxY)/2; }

    scaled(mul: number): Rect {
        return new Rect(this.minX*mul, this.maxX*mul, this.minY*mul, this.maxY*mul);
    }

    scale(mul: number): void {
        this.minX *= mul;
        this.maxX *= mul;
        this.minY *= mul;
        this.maxY *= mul;
    }

    expandedWith(point: Point): Rect;
    expandedWith(rect: Rect): Rect;
    expandedWith(thing: Point | Rect): Rect {
        const res = this.clone();
        if (thing instanceof Point) res.expandWith(thing);
        else if (thing instanceof Rect) res.expandWith(thing);
        else throw new Error("Unimplemented Rect.prototype.expandedWith overload");
        return res;
    }

    expandWith(point: Point): void;
    expandWith(rect: Rect): void;
    expandWith(thing: Point | Rect): void {
        const rect: Rect = (() => {
            if (thing instanceof Point) {
                return new Rect(thing.x, thing.x, thing.y, thing.y);
            } else if (thing instanceof Rect) {
                return thing;
            } else {
                throw new Error("Unimplemented Rect.prototype.expandWith overload");
            }
        })();

        this.minX = Math.min(this.minX, rect.minX);
        this.maxX = Math.max(this.maxX, rect.maxX);
        this.minY = Math.min(this.minY, rect.minY);
        this.maxY = Math.max(this.maxY, rect.maxY);
    }

    translate(ds: Vector) {
        this.minX += ds.x;
        this.maxX += ds.x;
        this.minY += ds.y;
        this.maxY += ds.y;
    }

    isPointInside(pt: Point, isStrict: boolean = false): boolean {
        if (isStrict)
            return pt.x > this.minX && pt.x < this.maxX && pt.y > this.minY && pt.y < this.maxY;
        else
            return pt.x >= this.minX && pt.x <= this.maxX && pt.y >= this.minY && pt.y <= this.maxY;
    }

    doesLineIntersectBorder(v1: Point, v2: Point) {
        const topLeft     = new Point(this.minX, this.minY);
        const topRight    = new Point(this.maxX, this.minY);
        const bottomLeft  = new Point(this.minX, this.maxY);
        const bottomRight = new Point(this.maxX, this.maxY);
        return doLineSegmentsIntersect(v1, v2, topLeft, topRight)
            || doLineSegmentsIntersect(v1, v2, topRight, bottomRight)
                || doLineSegmentsIntersect(v1, v2, bottomRight, bottomLeft)
                    || doLineSegmentsIntersect(v1, v2, bottomLeft, topLeft);
    }

    clone() {
        return new Rect(this.minX, this.maxX, this.minY, this.maxY);
    }
}

/**
 * @author Peter Kelley
 * @author pgkelley4@gmail.com
 */

/**
 * See if two line segments intersect. This uses the
 * vector cross product approach described below:
 * http://stackoverflow.com/a/565282/786339
 *
 * @param {Object} p point object with x and y coordinates
 *  representing the start of the 1st line.
 * @param {Object} p2 point object with x and y coordinates
 *  representing the end of the 1st line.
 * @param {Object} q point object with x and y coordinates
 *  representing the start of the 2nd line.
 * @param {Object} q2 point object with x and y coordinates
 *  representing the end of the 2nd line.
 */
export function doLineSegmentsIntersect(p: Point, p2: Point, q: Point, q2: Point) {
    var r = subtractPoints(p2, p);
    var s = subtractPoints(q2, q);

    var uNumerator = crossProduct(subtractPoints(q, p), r);
    var denominator = crossProduct(r, s);

    if (uNumerator == 0 && denominator == 0) {
        // They are coLlinear

        // Do they touch? (Are any of the points equal?)
        if (equalPoints(p, q) || equalPoints(p, q2) || equalPoints(p2, q) || equalPoints(p2, q2)) {
            return true
        }
        // Do they overlap? (Are all the point differences in either direction the same sign)
        return !allEqual(
            (q.x - p.x < 0),
            (q.x - p2.x < 0),
            (q2.x - p.x < 0),
            (q2.x - p2.x < 0)) ||
                !allEqual(
                    (q.y - p.y < 0),
                    (q.y - p2.y < 0),
                    (q2.y - p.y < 0),
                    (q2.y - p2.y < 0));
    }

    if (denominator == 0) {
        // lines are paralell
        return false;
    }

    var u = uNumerator / denominator;
    var t = crossProduct(subtractPoints(q, p), s) / denominator;

    return (t >= 0) && (t <= 1) && (u >= 0) && (u <= 1);
}

function crossProduct(point1: Point, point2: Point) {
    return point1.x * point2.y - point1.y * point2.x;
}

function subtractPoints(point1: Point, point2: Point) {
    return new Point(point1.x - point2.x, point1.y - point2.y);
}

function equalPoints(point1: Point, point2: Point) {
    return (point1.x == point2.x) && (point1.y == point2.y)
}

function allEqual<T>(arg0: T, ...args: T[]) {
    for (const arg of args) {
        if (arg != arg0) return false;
    }
    return true;
}
