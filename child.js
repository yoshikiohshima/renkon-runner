import {ProgramState} from "renkon-core";

import {EventSource, RecordsWriter} from "./record.js";

const bindings = {
    EventSource,
    RecordsWriter
};

const programState = new ProgramState(Date.now(), bindings);

process.stdin.on("data", (chunk) => {
    console.log("child", chunk.toString());
    const input = JSON.parse(chunk.toString());
    console.log("input", input);
    if (input.code) {
        programState.setupProgram(input.code);
    }
    // so that you can set it up and start running with one "data"
    if (input.status) {
        if (input.status === "start") {
            console.log("starting");
            if (programState.evaluatorRunning === 0) {
                programState.nodeEvaluator();
            }
        } else if (input.status === "stop") {
            if (programState.evaluatorRunning !== 0) {
                clearInterval(programState.evaluatorRunning);
                programState.evaluatorRunning == 0;
            }
        }
    }
});
