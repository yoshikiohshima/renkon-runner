import readline from "readline";
import {ProgramState} from "renkon-core";

import {EventSource, RecordsWriter} from "./record.js";

const bindings = {
    EventSource,
    RecordsWriter
};

const programState = new ProgramState(Date.now(), bindings);

const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
});

let started = false;

rl.on("line", (line) => {
    const input = JSON.parse(line);
    console.log("input", input);
    if (input.code) {
        programState.setupProgram(input.code);
    }
    // so that you can set it up and start running with one "data"
    if (input.status) {
        if (input.status === "start") {
            if (!started) {
                started = true;
                debugger;
                programState.evaluator(Date.now(), {noAnimationFrame: true});
            } else {
                programState.start();
            }
        } else if (input.status === "stop") {
            programState.stop();
        }
    }
});
