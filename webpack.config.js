const path = require("path");

module.exports = {
    watch: true,
    mode: "development",
    entry: "./src/index.ts",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: require.resolve("pressure"),
                use: "exports-loader?type=commonjs&exports=Pressure",
            }
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            p5: "p5/lib/p5.js",
            pressure: "pressure/dist/pressure.js",
        },
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
};
