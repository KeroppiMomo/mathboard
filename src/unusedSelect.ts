// function isSelect(stroke) {
//     function inclination(v1, v2) {
//         return (Math.atan2(v2.y - v1.y, v2.x - v1.x) + 2*Math.PI) % (2*Math.PI);
//     }
//     function angleRotated(v1, v2, v3) {
//         const oldAngle = inclination(v2, v1);
//         const newAngle = inclination(v3, v2);
//         const raw = oldAngle - newAngle;
//         const normalized = Math.abs(raw) % (2*Math.PI);
//         return Math.min(normalized, 2*Math.PI - normalized);
//     }
//     function isAngleBetween(a, b, ang) {
//         let start = Math.min(a, b);
//         let end = Math.max(a, b);
//         console.log(start, end, ang);
//         if (end-start > Math.PI) { // |***s        e**|
//             return ang >= end || ang <= start;
//         } else { // |      s****e    |
//             return ang >= start && ang <= end;
//         }
//     }
//     function sqDistFromLine(v1, v2, v3) {
//         return Math.pow(v2.x*v1.y - v3.x*v1.y - v1.x*v2.y + v3.x*v2.y + v1.x*v3.y - v2.x*v3.y, 2) / (Math.pow(v1.x-v2.x, 2) + Math.pow(v1.y-v2.y, 2));
//     }
//     function segmentDist(v1, v2) {
//         return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2))
//     }

//     // let totalDist = 0;
//     // for (let i=1; i<stroke.vertices.length; ++i) {
//     //     totalDist += segmentDist(stroke.vertices[i-1], stroke.vertices[i]);
//     // }
//     // let minDiag = Infinity;
//     // for (let rot = 0; rot < 100; rot++) {
//     //     const angle = Math.PI*rot/100;
//     //     const cos = Math.cos(angle), sin = Math.sin(angle);
//     //     for (const v of stroke.vertices) {
//     //         const rotX = v.x * cos - v.y * sin;
//     //         const rotY = v.x * sin + v.y * cos;
//     //         minX = Math.min(minX, rotX);
//     //         maxX = Math.max(maxX, rotX);
//     //         minY = Math.min(minY, rotY);
//     //         maxY = Math.max(maxY, rotY);
//     //     }
//     //     minDiag = Math.min(minDiag, Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY,2)));
//     //     console.log(minDiag);
//     // }
//     // alert(totalDist / minDiag);

//     // function windowAvg(w) {
//     //     let res = [];
//     //     let sum = {x:0, y:0};
//     //     let i = 0;
//     //     let j = 1;
//     //     let dist = 0;
//     //     while (j < stroke.vertices.length) {
//     //         while (j < stroke.vertices.length && dist < w) {
//     //             const newDist = segmentDist(stroke.vertices[j-1], stroke.vertices[j]);
//     //             dist += newDist;
//     //             sum.x += stroke.vertices[j].x * newDist;
//     //             sum.y += stroke.vertices[j].y * newDist;
//     //             j++;
//     //         }
//     //         res.push({x: sum.x / dist, y: sum.y / dist});
//     //         while (i < j && dist >= w) {
//     //             const newDist = segmentDist(stroke.vertices[i], stroke.vertices[i+1]);
//     //             dist -= newDist;
//     //             sum.x -= stroke.vertices[i+1].x * newDist;
//     //             sum.y -= stroke.vertices[i+1].y * newDist;
//     //             i++;
//     //         }
//     //     }
//     //     return res;
//     // }

//     // let minScore = Infinity;
//     // let minW = 0;
//     // for (let w = 1; w < 100000; w++) {
//     //     const avgs = windowAvg(w);
//     //     if (avgs.length < 5) break;
//     //     let angleSum = 0;
//     //     for (let i=2; i<avgs.length; ++i) {
//     //         angleSum += angleRotated(avgs[i-2], avgs[i-1], avgs[i]);
//     //     }
//     //     let distSum = 0;
//     //     for (let i=1; i<avgs.length; ++i) {
//     //         distSum += segmentDist(avgs[i], avgs[i-1]);
//     //     }
//     //     const score = angleSum - distSum*Math.pow(w,1.4);
//     //     if (score < minScore) {
//     //         minScore = score;
//     //         minW = w;
//     //     }
//     // }

//     // debugDots.push(...windowAvg(minW));

//     // let periodBegin = 3;
//     // while (true) {
//     //     let i = periodBegin;
//     //     const oriAngle = inclination(stroke.vertices[i-3], stroke.vertices[i-2]);
//     //     let lastAngle = inclination(stroke.vertices[i-2], stroke.vertices[i-1]);
//     //     let isBroken = false;
//     //     // for (; i < stroke.vertices.length; ++i) {
//     //     //     let curAngle = inclination(stroke.vertices[i-1], stroke.vertices[i]);
//     //     //     if (isAngleBetween(lastAngle, curAngle, 2*Math.PI - oriAngle)) {
//     //     //         isBroken = true; // lmao
//     //     //         break;
//     //     //     }
//     //     //     lastAngle = curAngle;
//     //     // }
//     //     // if (!isBroken) break;
//     //     // debugDots.push(stroke.vertices[i]);
//     //     // isBroken = false;
//     //     for (; i < stroke.vertices.length; ++i) {
//     //         let curAngle = inclination(stroke.vertices[i-1], stroke.vertices[i]);
//     //         if (isAngleBetween(lastAngle, curAngle, oriAngle)) {
//     //             isBroken = true;
//     //             break;
//     //         }
//     //         lastAngle = curAngle;
//     //     }
//     //     if (!isBroken) break;
//     //     const periodEnd = i;

//     //     debugDots.push(stroke.vertices[periodEnd]);

//     //     // let accAngle = 0;
//     //     // do {
//     //     //     accAngle += angleRotated(stroke.vertices[i-2], stroke.vertices[i-1], stroke.vertices[i]);
//     //     //     i++;
//     //     // } while (i < stroke.vertices.length && accAngle < 2*Math.PI);

//     //     // if (accAngle < 2*Math.PI) break;

//     //     // let periodEnd = i;

//     //     // const v1 = stroke.vertices[periodBegin], v2 = stroke.vertices[periodEnd];
//     //     // const wavelength = Math.sqrt(Math.pow(v1.x-v2.x, 2) + Math.pow(v1.y-v2.y, 2));
//     //     // let posMaxSqDist = 0, negMaxSqDist = 0;
//     //     // for (i = periodBegin; i < periodEnd; ++i) {
//     //     //     const v3 = stroke.vertices[i];
//     //     //     if ((v3.x-v1.x)*(v2.y-v1.y) - (v3.y-v1.y)*(v2.x-v1.x) > 0) {
//     //     //         posMaxSqDist = Math.max(posMaxSqDist, sqDistFromLine(v1, v2, v3));
//     //     //     } else {
//     //     //         negMaxSqDist = Math.max(negMaxSqDist, sqDistFromLine(v1, v2, v3));
//     //     //     }
//     //     // }
//     //     // const amplitude = Math.sqrt(posMaxSqDist) + Math.sqrt(negMaxSqDist);

//     //     // debugDots.push(v2);
//     //     // alert(amplitude/wavelength);

//     //     periodBegin = periodEnd;
//     // }
//     console.log("-----");
// }

// function fourier(stroke, freq) {
//     let xSum = 0, ySum = 0;
//     for (let i = 0; i<stroke.vertices.length; ++i) {
//         const phase = -2*Math.PI*freq*i;
//         xSum += stroke.vertices[i].x * Math.cos(phase) - stroke.vertices[i].y * Math.cos(phase);
//         ySum += stroke.vertices[i].x * Math.sin(phase) + stroke.vertices[i].y * Math.sin(phase);
//     }
//     return {x: xSum, y: ySum};
// }
