# Mathboard
A demo of using mathematics handwriting recognition to improve digital notetaking experiences.

Existing notetaking apps allow users to convert their handwriting to LaTeX-typeset mathematical expressions.
However to edit the converted expressions, users often have to modify the LaTeX source code,
which is difficult and unnatural in a notetaking app.
This project offers an alternative, non-obstructive approach where handwritting recognition is used
to let user edit mathematical handwritting conveniently.

## Handwriting recognition
This feature is powered by the [MyScript iink SDK](https://developer.myscript.com/).
Handwritten strokes are continuously processed as the user writes.
Mathboard keeps track of a tree of "blocks",
each representing a specific semantic structure that appears in the handwriting,
such as a fraction or a subscript.

Notetaking apps can take advantage of this tree to
interpret semantic meanings and apply powerful transformations to users' handwritting.

![Handwriting recognition when writing the fundamental theorem of calculus](demo/recognition_calculus.mov)
![Handwriting recognition when writing the Einstein field equations](demo/recognition_einstein.mov)

## Smart deletion
An algorithm detects whether the current handwritten stroke resembles a scribble,
and if so, Mathboard switches to the "auto-delete" mode,
where subsequently crossed out content will be deleted.

![Gesture to trigger handwriting deletion](demo/deletion_gesture.mov)

Moreover, by identifying how the deleted blocks relate to other blocks using the block tree,
the remaining handwriting is modified to express the predicted semantic meaning.
For example, when deleting symbols in the numerator of a fraction,
surrounding symbols move in to fill the gap and the fraction line shrinks.

Currently smart deletion is only supported on a limited set of blocks.

![Remaining handwriting is modified after deletion](demo/deletion_auto_movement.mov)

This provides a seamless and convenient method to remove existing handwriting without manually moving around surrounding symbols,
along with sufficient feedback for users to anticipate when deletion will occur.

## Technical Details
- [p5.js](https://p5js.org/) is used for UI rendering.
- [Pressure.js](https://pressurejs.com/) is used to gather pressure information from digital styluses.
- [Webpack](https://webpack.js.org/) bundles the TypeScript code.
- As mentioned, Mathboard relies on the [MyScript iink SDK](https://developer.myscript.com/).
    To obtain an API key, go to the [MyScript Cloud console](https://cloud.myscript.com/), create an application, and generate a key.
    Then replace `applicationKey` and `hmacKey` in `src/recognition/recognition.ts` with the values you get.

Run `npm run build` to compile, and then `npm run start` to host the web page on localhost.
I recommend opening the web page on a tablet (e.g. an iPad) to make testing easier.
