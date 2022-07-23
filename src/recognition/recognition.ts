import { HmacSHA512, enc as cryptoEnc } from "crypto-js";
import { Stroke } from "../stroke";
import { Block } from "./block";
import { RecognitionResult } from "./blocks";
import { RecognitionParseError } from "./error";

export class Recognition {
    static readonly applicationKey = '03c2a697-9181-4c23-bf39-a6cc492050e7';
    static readonly hmacKey = '41b3430d-2a31-4efb-afd9-4a9edcd8e41c';
    static readonly restURL = 'https://cloud.myscript.com/api/v4.0/iink/batch';
    static readonly latexMime = 'application/x-latex';
    static readonly jiixMime = 'application/vnd.myscript.jiix';

    static stored = new RecognitionResult();

    static computeHmac(input: string) {
        return HmacSHA512(input, Recognition.applicationKey + Recognition.hmacKey).toString(cryptoEnc.Hex)
    }

    static async post(data: {[key: string]: any}) {
        const headers = new Headers();
        headers.append('Accept', 'application/json,' + Recognition.jiixMime);
        headers.append('applicationKey', Recognition.applicationKey);
        headers.append('hmac', Recognition.computeHmac(JSON.stringify(data)));
        headers.append('Content-Type', 'application/json');
        const request = new Request(Recognition.restURL, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify(data)
        });
        const response = await fetch(request);
        return await response.json();
    }

    static async update(strokes: Stroke[], windowWidth: number, windowHeight: number) {
        const data = {
            configuration: {
                "export":{"jiix":{"bounding-box":true,"strokes":true,"style":false}},
            },
            contentType: "Math",
            strokeGroups: [{
                strokes: strokes.map((stroke) => {
                    let res = {x: new Array<number>(), y: new Array<number>(), t: new Array<number>(), p: new Array<number>()};
                    for (const vertex of stroke.vertices) {
                        res.x.push(vertex.x);
                        res.y.push(vertex.y);
                        res.t.push(vertex.t);
                        res.p.push(vertex.p);
                    }
                    return res;
                }),
            }],
            width: windowWidth,
            height: windowHeight,
        };
        const json: any = await Recognition.post(data);
        try {
            Recognition.stored = RecognitionResult.parse(json);
            for (const block of Recognition.stored.dfs()) {
                for (const child of block.children) {
                    child.parent = new WeakRef(block);
                }
            }
            console.log(Recognition.stored);
        } catch (error) {
            if (error instanceof RecognitionParseError) {
                console.error(error.json);
            } else {
                console.error(json);
            }
            throw error;
        }
    }

    static* dfs(): IterableIterator<Block> {
        // Wow first time I've used generator function
        if (Recognition.stored) {
            yield* Recognition.stored.dfs();
        }
    }
}
