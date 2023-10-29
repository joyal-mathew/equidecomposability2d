"use strict";

const POINT_COINDICENT_TOLERENCE = 10;

const shapes = [];

const canvas = document.getElementById("display");
const context = canvas.getContext("2d");

canvas.width = innerWidth;
canvas.height = innerHeight;

let drawing = null;
let locked = 0;
let drawingColor = "black";
let animation = false;

addEventListener("mousedown", e => {
    if (animation) return;
    const mouse = { x: e.clientX, y: e.clientY };
    shapes.splice(0, shapes.length);

    if (e.button === 0) {
        if (drawing === null) {
            drawing = [mouse];
            locked = 1;
        }
        else {
            if (isClosing(mouse)) {
                drawing.pop();
                attemptSolve();
            }
            else if (!selfIntersects()) {
                drawing.push(mouse);
                locked += 1;
            }
        }
    }
    else if (e.button === 2 && drawing.length > 2) {
        if (drawing !== null) {
            if (isClosing(mouse)) {
                drawing.pop();
                attemptSolve();
            }
            else if (!selfIntersects()) {
                attemptSolve();
            }
        }
    }
});

addEventListener("mousemove", e => {
    if (drawing !== null) {
        const mouse = { x: e.clientX, y: e.clientY };

        if (drawing.length === locked) {
            drawing.push(mouse);
        }
        else {
            drawing[locked] = mouse;
        }

        if (isClosing(mouse)) {
            drawing[locked] = drawing[0];
            drawingColor = "green";
        }
        else {
            drawingColor = selfIntersects() ? "red" : "black";
        }
    }
});

requestAnimationFrame(drawShapes);

function isClosing(mouse) {
    return locked > 2 && distance(mouse, drawing[0]) <= POINT_COINDICENT_TOLERENCE
}

function attemptSolve() {
    drawing.push(drawing[0]);
    if (!selfIntersects(true)) {
        drawing.pop();
        shapes.push(drawing);
        drawing = null;
        animation = true;
        cutPolygon().then(() => {
            shapes.splice(0, shapes.length, ...shapes.filter(e => e));
            Promise.all(shapes.map((_, i) => triangleToParallelogram(i)
                                   .then(i => parallelogramToRectangle(i))
                                   .then(i => rectangleToSquare(i))))
                .then(() => {
                    shapes.splice(0, shapes.length, ...shapes.filter(e => e));
                    return combineSquares();
                })
                .then(() => {
                    animation = false;
                    shapes.splice(0, shapes.length, ...shapes.filter(e => e));
                });
        });
    }
    else {
        drawing.pop();
    }
}

function selfIntersects(allowedCoincidents) {
    allowedCoincidents = allowedCoincidents || 0;

    if (drawing.length < 2) {
        return false;
    }

    let foundCoincidents = 0;

    for (let i = 0; i < drawing.length; ++i) {
        for (let j = i + 1; j < drawing.length; ++j) {
            if (distanceSq(drawing[i], drawing[j]) <= POINT_COINDICENT_TOLERENCE) foundCoincidents += 1;
            if (foundCoincidents > allowedCoincidents) return true;
        }
    }

    const p1 = drawing[drawing.length - 2];
    const p2 = drawing[drawing.length - 1];

    for (let i = 0; i < drawing.length - 2; ++i) {
        const p3 = drawing[i + 0];
        const p4 = drawing[i + 1];

        if (linesIntersect(p1, p2, p3, p4)) {
            return true;
        }
    }

    return false;
}

function pointsEqual(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
}

function linesIntersect(p1, p2, p3, p4, draw) {
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));

    if (draw) {
        context.beginPath();
        context.moveTo(p1.x, p1.y);
        context.lineTo(p2.x, p2.y);
        context.stroke();
        context.beginPath();
        context.moveTo(p3.x, p3.y);
        context.lineTo(p4.x, p4.y);
        context.stroke();
        context.beginPath();
        context.arc(p1.x, p1.y, 8, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.arc(p2.x, p2.y, 8, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.arc(p3.x, p3.y, 8, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.arc(p4.x, p4.y, 8, 0, Math.PI * 2);
        context.stroke();
    }

    const pi = {
        x: p1.x + (ua * (p2.x - p1.x)),
        y: p1.y + (ua * (p2.y - p1.y)),
    };

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1 && !pointsEqual(p1, pi) && !pointsEqual(p2, pi);
}

function drawShapes() {
    requestAnimationFrame(drawShapes);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#00000010";

    if (drawing !== null) {
        context.strokeStyle = drawingColor;
        context.beginPath();
        context.moveTo(drawing[0].x, drawing[0].y);
        for (const p of drawing.slice(1)) {
            context.lineTo(p.x, p.y);
        }
        context.stroke();
        context.fill();
    }

    for (const shape of shapes) {
        if (shape) {
            context.strokeStyle = "black";
            context.beginPath();
            if (shape.hasOwnProperty("x")) {
                context.arc(shape.x, shape.y, 8, 0, Math.PI * 2);
            }
            else {
                context.moveTo(shape[0].x, shape[0].y);
                for (const p of shape.slice(1)) {
                    context.lineTo(p.x, p.y);
                }
                context.lineTo(shape[0].x, shape[0].y);
            }
            context.stroke();
            context.fill();
        }
    }
}

function rotateShapeInstant(shape, angle, center) {
    for (let i = 0; i < shape.length; ++i) {
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        const p = {
            x: shape[i].x - center.x,
            y: shape[i].y - center.y,
        };

        const nx = p.x * cos - p.y * sin;
        const ny = p.x * sin + p.y * cos;

        p.x = nx + center.x;
        p.y = ny + center.y;

        shape[i] = p;
    }
}

function translateShapeInstant(shape, x, y) {
    for (let i = 0; i < shape.length; ++i) {
        shape[i] = {
            x: shape[i].x + x,
            y: shape[i].y + y,
        };
    }
}

async function rotateShape(shape, angle, center) {
    return new Promise(res => {
        let currentAngle = 0;

        function increment() {
            if (Math.abs(currentAngle) >= Math.abs(angle)) {
                rotateShapeInstant(shape, angle - currentAngle, center);
                res();
            }
            else {
                rotateShapeInstant(shape, Math.PI / 180 * Math.sign(angle), center);
                currentAngle += Math.PI / 180 * Math.sign(angle);
                setTimeout(increment, 0);
            }
        }

        increment();
    });
}

async function translateShape(shape, x, y) {
    return new Promise(res => {
        const magnitude = Math.hypot(x, y);
        const dx = x / magnitude;
        const dy = y / magnitude;

        let currentX = 0;
        let currentY = 0;

        function increment() {
            if (Math.abs(currentX) >= Math.abs(x) && Math.abs(currentY) >= Math.abs(y)) {
                translateShapeInstant(shape, x - currentX, y - currentY);
                res();
            }
            else {
                translateShapeInstant(shape, dx, dy);
                currentX += dx;
                currentY += dy;
                setTimeout(increment, 0);
            }
        }

        increment();
    });
}

async function pause(time) {
    return new Promise(res => {
        setTimeout(res, time);
    });
}

async function cutPolygon() {
    await pause(1000);
    const polygon = shapes[0];
    shapes[0] = null;

    cut: while (polygon.length > 3) {
        findCuts: for (let i = 0; i < polygon.length; ++i) {
            const p1 = polygon[mod(i - 2, polygon.length)];
            const p2 = polygon[i];

            const m = midpoint(p1, p2);
            const o = { x: 0, y: 0 };

            let intersections = 0;

            for (let j = 0; j < polygon.length; ++j) {
                const p3 = polygon[mod(j - 1, polygon.length)];
                const p4 = polygon[j];

                if (linesIntersect(p1, p2, p3, p4)) {
                    continue findCuts;
                }
                if (linesIntersect(m, o, p3, p4, true)) {
                    intersections += 1;
                }
            }

            if (intersections % 2) {
                shapes.push([
                    p1,
                    polygon[mod(i - 1, polygon.length)],
                    p2,
                ]);
                polygon.splice(mod(i - 1, polygon.length), 1);
                drawShapes();

                continue cut;
            }
        }

        throw "could not cut";
    }

    shapes.push(polygon);
}

async function triangleToParallelogram(shapeIndex) {
    await pause(1000);
    const shape = shapes[shapeIndex];
    shapes[shapeIndex] = null;

    const a = shape[0];
    const b = shape[1];
    const c = shape[2];

    const d = midpoint(a, b);
    const e = midpoint(b, c);

    const shape1 = [ d, e, b ];
    const shape2 = [ a, d, e, c ];

    const newIndex = shapes.push(shape1, shape2) - 2;

    await rotateShape(shape1, Math.PI, d);

    shapes[newIndex] = null;
    shapes[newIndex + 1] = null;
    return shapes.push([ a, c, e, shape1[1] ]) - 1;
}

async function parallelogramToRectangle(shapeIndex) {
    await pause(1000);
    const shape = shapes[shapeIndex];
    shapes[shapeIndex] = null;

    let a = shape[0];
    let b = shape[1];
    let c = shape[2];
    let d = shape[3];

    const acAngle = angle(a, b, d);
    const bdAngle = angle(b, a, c);

    if (acAngle < bdAngle) {
        [a, b, c, d] = [b, c, d, a];
    }
    else if (acAngle === bdAngle) {
        shapes.push(shape);
        return;
    }

    const e1 = parallelogramPerpendiculars(bdAngle, a, b, c);
    const e2 = parallelogramPerpendiculars(bdAngle, a, d, c);
    const delta1 = distance(e1, b) + distance(e1, c) - distance(b, c);
    const delta2 = distance(e2, d) + distance(e2, c) - distance(d, c);

    let translateX;
    let translateY;
    let shape1;
    let shape2;
    if (delta1 < delta2) {
        shape1 = [a, e1, b];
        shape2 = [a, e1, c, d];

        translateX = d.x - a.x;
        translateY = d.y - a.y;
    }
    else {
        shape1 = [a, e2, d];
        shape2 = [a, e2, c, b];

        translateX = b.x - a.x;
        translateY = b.y - a.y;
    }

    let newIndex = shapes.push(shape1, shape2) - 2;

    await translateShape(shape1, translateX, translateY);

    shapes[newIndex] = null;
    shapes[newIndex + 1] = null;

    return shapes.push([
        shape1[1], shape1[0],
        shape2[0], shape2[1],
    ]) - 1;
}

async function rectangleToSquare(shapeIndex) {
    await pause(1000);
    const shape = shapes[shapeIndex];
    shapes[shapeIndex] = null;

    let a = shape[0];
    let b = shape[1];
    let c = shape[2];
    let d = shape[3];

    if (distance(a, b) < distance(a, d)) {
        [a, b, c, d] = [b, c, d, a];
    }
    else if (distance(a, b) === distance(a, d)) {
        shapes.push([a, b, c, d]);
        return;
    }

    while (distance(a, d) * 2 < distance(a, b)) {
        const e = midpoint(a, b);
        const f = midpoint(c, d);

        const shape1 = [a, e, f, d];
        const shape2 = [e, b, c, f];

        const tempIndex = shapes.push(shape1, shape2) - 2;

        await rotateShape(shape2, Math.PI, f);

        a = shape1[0];
        b = shape1[1];
        c = shape2[0];
        d = shape2[1];

        if (distance(a, b) < distance(a, d)) {
            [a, b, c, d] = [b, c, d, a];
        }
        else if (distance(a, b) === distance(a, d)) {
            shapes.push([a, b, c, d]);
            return;
        }

        shapes[tempIndex] = null;
        shapes[tempIndex + 1] = null;
    }

    const k = shapes.push([a, b, c, d]) - 1;
    await pause(1000);

    const q = distance(a, b);
    const w = distance(a, d);

    const s1 = Math.sqrt(q * w - w * w);
    const g = {
        x: (c.x - d.x) / q,
        y: (c.y - d.y) / q,
    };

    g.x = d.x + g.x * s1;
    g.y = d.y + g.y * s1;

    const s2 = Math.sqrt(q * q - q * w);
    const h = {
        x: (g.x - a.x) / Math.sqrt(q * w),
        y: (g.y - a.y) / Math.sqrt(q * w),
    };

    h.x = a.x + h.x * s2;
    h.y = a.y + h.y * s2;

    const shape1 = [a, g, d];
    const shape2 = [a, b, h];
    const shape3 = [h, b, c, g];

    shapes[k] = null;
    const tempIndex = shapes.push(shape1, shape2, shape3) - 3;

    await Promise.all([
        translateShape(shape1, c.x - d.x, c.y - d.y),
        translateShape(shape2, g.x - a.x, g.y - a.y),
    ]);

    shapes[tempIndex + 0] = null;
    shapes[tempIndex + 1] = null;
    shapes[tempIndex + 2] = null;

    shapes.push([
        shape3[0],
        shape3[1],
        shape1[1],
        shape2[2],
    ]);
}

async function combineTwoSquares(i, j, x, y) {
    const square1 = shapes[i];
    const square2 = shapes[j];
    const side1 = distance(square1[0], square1[1]);
    const side2 = distance(square2[0], square2[1]);
    const sideMean = (side1 + side2) / 2;

    let bl1 = axisAlignedSquareCorner(square1, "BL");
    let bl2 = axisAlignedSquareCorner(square2, "BL");
    let tl1 = axisAlignedSquareCorner(square1, "TL");
    let tl2 = axisAlignedSquareCorner(square2, "TL");
    let br1 = axisAlignedSquareCorner(square1, "BR");
    let br2 = axisAlignedSquareCorner(square2, "BR");
    let tr1 = axisAlignedSquareCorner(square1, "TR");
    let tr2 = axisAlignedSquareCorner(square2, "TR");

    await pause(1000);
    await Promise.all([
        translateShape(square1, x - sideMean - bl1.x, y + sideMean  - bl1.y),
        translateShape(square2, x - sideMean + side1 - bl2.x, y + sideMean - bl2.y),
    ]);

    bl1 = axisAlignedSquareCorner(square1, "BL");
    bl2 = axisAlignedSquareCorner(square2, "BL");
    tl1 = axisAlignedSquareCorner(square1, "TL");
    tl2 = axisAlignedSquareCorner(square2, "TL");
    br1 = axisAlignedSquareCorner(square1, "BR");
    br2 = axisAlignedSquareCorner(square2, "BR");
    tr1 = axisAlignedSquareCorner(square1, "TR");
    tr2 = axisAlignedSquareCorner(square2, "TR");

    const a = {
        x: bl1.x + side2,
        y: br1.y,
    };

    const shape1 = [tl1, a, bl1];
    const shape2 = [tr2, a, br2];
    const shape3 = [tl1, a, tr2, tl2, tr1];

    await pause(1000);

    shapes[i] = null;
    shapes[j] = null;

    const k = shapes.push(shape1, shape2, shape3) - 1;

    await pause(1000);

    await Promise.all([
        rotateShape(shape1, Math.PI * 3 / 2, tl1),
        rotateShape(shape2, Math.PI / 2, tr2),
    ]);

    shapes[k - 0] = null;
    shapes[k - 1] = null;
    shapes[k - 2] = null;
    const l = shapes.push([
        shape1[0],
        shape1[1],
        shape2[0],
        a,
    ]) - 1;

    await pause(1000);
    await rotateShape(shapes[l], shapeReturnRotation(shapes[l]), polygonCenter(shapes[l]));
}

async function combineSquares() {
    await pause(1000);
    await Promise.all(shapes.map(s => rotateShape(s, shapeReturnRotation(s), polygonCenter(s))));

    while (shapes.length > 1) {
        const radii = [];

        for (let i = 1; i < shapes.length; i += 2) {
            radii.push(combinedSquareRadius(shapes[i - 1], shapes[i]));
        }

        const points = getCombinationPoints(radii);
        const promises = [];

        if (points.length === 1) {
            points[0] = { x: canvas.width / 2, y: canvas.height / 2  };
        }

        for (let i = 1; i < shapes.length; i += 2) {
            const j = i / 2 | 0;
            promises.push(combineTwoSquares(i - 1, i, points[j].x, points[j].y));
        }

        await Promise.all(promises);

        shapes.splice(0, shapes.length, ...shapes.filter(e => e));
    }
}

function midpoint(p1, p2) {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
    };
}

function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function distanceSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
}

function angle(p1, p2, p3) {
    const p12 = distance(p1, p2);
    const p13 = distance(p1, p3);
    const p23 = distance(p2, p3);

    return Math.acos((p12 * p12 + p13 * p13 - p23 * p23) / (2 * p12 * p13));
}

function parallelogramPerpendiculars(angle, p1, p2, p3) {
    const len = distance(p1, p2) * Math.sin(angle);
    const lineAngle = Math.atan(-1 / ((p3.y - p2.y) / (p3.x - p2.x)));

    const e1 = {
        x: p1.x + len * Math.cos(lineAngle),
        y: p1.y + len * Math.sin(lineAngle),
    };
    const e2 = {
        x: p1.x - len * Math.cos(lineAngle),
        y: p1.y - len * Math.sin(lineAngle),
    };

    const delta1 = distance(e1, p2) + distance(e1, p3);
    const delta2 = distance(e2, p2) + distance(e2, p3);

    if (delta1 < delta2) {
        return e1;
    }
    else {
        return e2;
    }
}

function polygonCenter(polygon) {
    const p = {
        x: 0,
        y: 0,
    };

    for (let i = 0; i < polygon.length; ++i) {
        p.x += polygon[i].x;
        p.y += polygon[i].y;
    }

    p.x /= polygon.length;
    p.y /= polygon.length;

    return p;
}

function axisAlignedSquareCorner(square, type) {
    const xFunc = type[1] === "R" ? Math.max : Math.min;
    const yFunc = type[0] === "B" ? Math.max : Math.min;

    return {
        x: xFunc(...square.map(p => p.x)),
        y: yFunc(...square.map(p => p.y)),
    };
}

function randRange(min, max) {
    return Math.random() * (max - min) + min;
}

function shapeReturnRotation(shape) {
    return smallestReturnRotation(Math.atan2(shape[0].y - shape[1].y, shape[0].x - shape[1].x));
}

function smallestReturnRotation(angle) {
    angle %= Math.PI / 2;
    return Math.PI / 2 - angle;
    if (angle < Math.PI / 4) return -angle;
    else return Math.PI / 2 - angle;
}

function combinedSquareRadius(a, b) {
    const daSq = distanceSq(a[0], a[2]);
    const dbSq = distanceSq(b[0], b[2]);
    const cArea = (daSq + dbSq) / 2;

    return Math.sqrt(cArea) * Math.SQRT2 / 2;
}

function getCombinationPoints(radii) {
    return radii.map(r => ({ x: randRange(r, canvas.width - r), y: randRange(r, canvas.height - r) }));
}

function mod(n, m) {
    return (n % m + m) % m;
}
