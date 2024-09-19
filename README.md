# Mathboard
A demo of using mathematics handwriting recognition to improve digital notetaking experiences.

https://github.com/user-attachments/assets/f578eda7-cbf7-4b5d-8292-d0cbd08125c7

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

https://github.com/user-attachments/assets/ddca09d4-d55a-4709-a113-113fa220eb64

https://github.com/user-attachments/assets/43451875-4937-462c-ae06-2a4b03a3bd90

## Smart deletion
An algorithm detects whether the current handwritten stroke resembles a scribble,
and if so, Mathboard switches to the "auto-delete" mode,
where subsequently crossed out content will be deleted.

https://github.com/user-attachments/assets/cdc5ffd8-b3c9-413d-b9c7-14e647d27876

Moreover, by identifying how the deleted blocks relate to other blocks using the block tree,
the remaining handwriting is modified to express the predicted semantic meaning.
For example, when deleting symbols in the numerator of a fraction,
surrounding symbols move in to fill the gap and the fraction line shrinks.
See the first video for an example.

Currently smart deletion is only supported on a limited set of blocks.

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
