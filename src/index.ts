import * as p5 from "p5";
import * as Pressure from "pressure";
import { Stroke, StrokePoint } from "./stroke";
import { Point, Rect, doLineSegmentsIntersect } from "./utils";
import { Block, Recognition } from "./recognition";

if (crypto.randomUUID === undefined) {
    let autoIncrement = 0;
    crypto.randomUUID = () => (autoIncrement++).toString();
}

let pendingStrokes: {[key: string]: Stroke} = {};
let curStroke: Stroke | null = null;
let mode = 0;

let strokeBoxes: Rect[] = [];
let totalLength = 0;

export const sketchInstance = new p5((sketch) => {
    sketch.setup = () => setup(sketch);
    sketch.draw = () => draw(sketch);
    sketch.mousePressed = () => mousePressed(sketch);
    sketch.mouseDragged = () => mouseDragged(sketch);
    sketch.mouseReleased = () => mouseReleased(sketch);
    sketch.keyPressed = () => keyPressed(sketch);
});

let pressure = NaN;
function setup(sketch: p5) {
    disableScroll();
    Pressure.set("canvas", {
        unsupported: () => pressure = 0.2,
        change: (force) => pressure = force,
    }, {polyfill: false});
    sketch.createCanvas(sketch.windowWidth, sketch.windowHeight);
}

let debugDots: Point[] = [];
let deletionBlocks: Block[] = [];

function draw(sketch: p5) {
    sketch.background(30);

    drawStrokes(sketch);
    drawMode(sketch);
    drawDebugRecognition(sketch);
    drawFPS(sketch);
}

function drawStrokes(sketch: p5) {
    function drawNode(block: Block) {
        if (deletionBlocks.includes(block)) {
            sketch.stroke(255, 100, 100);
            block.strokes.forEach((s) => s.draw(sketch, (p) => p*8+10));
        }
        sketch.stroke(255);
        sketch.strokeWeight(2);
        block.strokes.forEach((s) => s.draw(sketch));
    }

    sketch.noFill();
    sketch.strokeWeight(1);
    for (const key in pendingStrokes) {
        sketch.stroke(180, 180, 255);
        pendingStrokes[key].draw(sketch);

        // const vertices = pendingStrokes[key].vertices;
        // const c = 100;
        // const a = vertices.at(-1)!.x;
        // const f = vertices.at(-1)!.y;
        // let last3AngleSum = 0;
        // for (let i = -1; i >= -3; --i) {
        //     last3AngleSum += Math.atan2(vertices.at(i)!.y - vertices.at(i-1)!.y, vertices.at(i)!.x - vertices.at(i-1)!.x);
        // }

        // let sumY = 0;
        // for (const vertex of vertices) {
        //     sumY += vertex.y;
        // }
        // let sumSquareSlope = 0;
        // for (let i=0; i < vertices.length-1; ++i) {
        //      sumSquareSlope += Math.pow((vertices[i].y - vertices[i+1].y)/(vertices[i].x - vertices[i+1].x), 2);
        // }
        // let rmsSlope = Math.sqrt(sumSquareSlope/(vertices.length-1));
        // const T = (x: number) => f + Math.tan(last3AngleSum/3)*(x-a);
        // // const d2fdx2 = (dfdx - dfdx2)/(vertices.at(-1)!.x - vertices.at(-2)!.x);
        // // + d2fdx2*(x-a)*(x-a)/2 <-- i decided to only have first order approximation since the second order term sometimes get too big
        // const S = (x: number) => 2/(1 + Math.exp(Math.pow((x-a)/c, 3)));
        // const I = (x: number) => S(x)*T(x) + (1-S(x))*(sumY/vertices.length + sketch.noise(x/60)*Math.min(20, Math.max(5, (rmsSlope*50))));

        // sketch.stroke(255, 20, 20);
        // sketch.beginShape();
        // for (let x = a; x < sketch.windowWidth; x += 1) {
        //     sketch.curveVertex(x, I(x));
        // }
        // sketch.endShape();
    }
    const gen = Recognition.stored.dfs();
    for (const block of gen) {
        drawNode(block);
    }

    sketch.stroke(150, 255, 255);
    curStroke?.draw(sketch);
}

function drawFPS(sketch: p5) {
    sketch.noStroke();
    sketch.fill(255);
    sketch.text(Math.round(sketch.frameRate()).toString(), 0, 10);
}

function drawMode(sketch: p5) {
    if (mode === 0) {
        sketch.noStroke();
        sketch.fill(255);
        sketch.rect(0, sketch.windowHeight - 50, sketch.windowWidth, 50);
        sketch.noStroke();
        sketch.fill(0);
        sketch.text("Draw", 10, sketch.windowHeight-20);
    } else if (mode === 1) {
        sketch.noStroke();
        sketch.fill(255, 100, 100);
        sketch.rect(0, sketch.windowHeight - 50, sketch.windowWidth, 50);
        sketch.noStroke();
        sketch.fill(0);
        sketch.text("Delete", 10, sketch.windowHeight-20);
    } else if (mode === 2) {
        sketch.noStroke();
        sketch.fill(100, 255, 150);
        sketch.rect(0, sketch.windowHeight - 50, sketch.windowWidth, 50);
        sketch.noStroke();
        sketch.fill(0);
        sketch.text("Auto-delete", 10, sketch.windowHeight-20);
    }
}

function drawBoundingBox(sketch: p5, box: Rect) {
    sketch.rect(box.minX, box.minY, box.width, box.height);
}
function drawDebugRecognition(sketch: p5) {
    if (!Recognition.stored.expressions) return;
    sketch.noFill();
    sketch.stroke(255, 255, 0);
    sketch.strokeWeight(1);

    const gen = Recognition.dfs();
    for (const block of gen) {
        drawBoundingBox(sketch, block.boundingBox);
    }
}
function drawDebugDots(sketch: p5) {
    for (const dot of debugDots) {
        sketch.fill(255, 0, 0);
        sketch.circle(dot.x, dot.y, 5);
    }
}

function getAllStrokes() {
    return [
        ...Object.values(pendingStrokes),
        ...Array.from(Recognition.dfs())
            .map((block) => block.strokes)
            .flat(),
    ];
}

let lastMousePos: StrokePoint | null = null;
let autoSwitchTime: number | undefined = undefined;
function mousePressed(sketch: p5) {
    lastMousePos = new StrokePoint(sketch.mouseX, sketch.mouseY, Date.now(), 50);
    curStroke = new Stroke();
    strokeBoxes = Array(100).fill(new Rect(Infinity, -Infinity, Infinity, -Infinity));
    totalLength = 0;
    deletionBlocks = [];
    autoSwitchTime = 0;
}

function mouseDragged(sketch: p5) {
    if (lastMousePos === null) throw new Error("Mouse is dragging but lastMousePos is null");
    if (curStroke === null) throw new Error("Mouse is dragging but curStroke is null");

    let mousePoint = new StrokePoint(sketch.mouseX, sketch.mouseY, Date.now(), pressure);
    if (mousePoint.x === lastMousePos.x && mousePoint.y === lastMousePos.y) return;
    curStroke.vertices.push(mousePoint);
    if (mode === 0) {
        if (curStroke.vertices.length > 2) totalLength += Math.sqrt(Math.pow(mousePoint.x - lastMousePos.x, 2) + Math.pow(mousePoint.y - lastMousePos.y, 2));
        let minDiag = Infinity;
        for (let rot=0; rot < 100; ++rot) {
            const rotX = mousePoint.x * Math.cos(Math.PI/100*rot) - mousePoint.y * Math.sin(Math.PI/100*rot);
            const rotY = mousePoint.x * Math.sin(Math.PI/100*rot) + mousePoint.y * Math.cos(Math.PI/100*rot);
            const box = strokeBoxes[rot];
            strokeBoxes[rot] = new Rect(
                Math.min(box.minX, rotX),
                Math.max(box.maxX, rotX),
                Math.min(box.minY, rotY),
                Math.max(box.maxY, rotY),
            );
            minDiag = Math.min(minDiag, Math.sqrt(Math.pow(box.maxX - box.minX, 2) + Math.pow(box.maxY - box.minY, 2)));
        }
        if (totalLength / minDiag > 3) {
            if (autoSwitchTime === undefined) autoSwitchTime = Date.now();
            else if (Date.now() - autoSwitchTime > 50) {
                mode = 2;
            }
        } else {
            autoSwitchTime = undefined;
        }
    } else if (mode === 1 || mode === 2) {
        const gen = Recognition.dfs();
        for (const block of gen) {
            const boundingBox = block.boundingBox;
            if (!(boundingBox.isPointInside(lastMousePos)
                || boundingBox.isPointInside(mousePoint)
                || boundingBox.doesLineIntersectBorder(mousePoint, lastMousePos))) continue;
            if (deletionBlocks.includes(block)) continue;
            for (const stroke of block.strokes) {
                let broken = false;
                for (let j=0; j < stroke.vertices.length-1; ++j) {
                    if (doLineSegmentsIntersect(mousePoint, lastMousePos, stroke.vertices[j], stroke.vertices[j+1])) {
                        deletionBlocks.push(block);
                        broken = true;
                        break;
                    }
                }
                if (broken) break;
            }
        }
        // for (const stroke of pendingStrokes) {
        //     for (let j=0; j < stroke.vertices.length-1; j++) {
        //         if (doLineSegmentsIntersect(mousePoint, lastMousePos, stroke.vertices[j], stroke.vertices[j+1])) {
        //             stroke.pendingDeletion = true;
        //             break;
        //         }
        //     }
        // }
    }
    lastMousePos = mousePoint;
}

function mouseReleased(sketch: p5) {
    if (mode === 1 || mode == 2) {
        console.log(deletionBlocks);
        const path = new WeakSet<Block>();

        for (const block of deletionBlocks) {
            let parent = block;
            path.add(block);
            while (parent.parent?.deref() !== undefined) {
                parent = parent.parent!.deref()!;
                path.add(parent);
            }
            // block.strokes = [];
            // const oriRect = block.boundingBox.clone();
            // block.boundingBox.maxX = block.boundingBox.minX;
            // block.boundingBox.maxY = block.boundingBox.minY;
            // block.parent?.deref()?.childResized(block, oriRect);
        }
        Recognition.stored.performDelete(path, new WeakSet(deletionBlocks));
        console.log(Recognition.stored);
        Recognition.update(getAllStrokes(), sketch.windowWidth, sketch.windowHeight);
        // pendingStrokes = pendingStrokes.filter((stroke) => !stroke.pendingDeletion);
        if (mode == 2) mode = 0;
    } else {
        addStroke(sketch);
    }
    curStroke = null;
}

function keyPressed(sketch: p5) {
    if (sketch.key === "d") mode = 1;
    if (sketch.keyCode === sketch.ESCAPE) mode = 0;
}


let autoIncrement = 0;
async function addStroke(sketch: p5) {
    if (!curStroke || curStroke.vertices.length == 0) return;
    const id = autoIncrement++;
    pendingStrokes[id] = curStroke;
    try {
        await Recognition.update(getAllStrokes(), sketch.windowWidth, sketch.windowHeight);
        delete pendingStrokes[id];
    } finally {
        // delete pendingStrokes[uuid];
    }
}

function disableScroll() {
    document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}
