import {ProgramState} from "renkon-core";

import {EventSource, RecordWriter} from "./record.js";

const bindings = {
    EventSource,
    RecordsWriter
};

const programState = new ProgramState(Date.now(), bindings);

process.stdin.on("data", (chunk) => {
    const input = JSON.parse(chunk.toString());
    if (input.code) {
        programState.setupProgram(input.code);
    }
    // so that you can set it up and start running with one "data"
    if (input.status) {
        if (input.status === "start") {
            if (programState.evaluatorRunning === 0) {
                programState.nodeEvaluator();
            }
        } else if (input.status === "stop") {
            if (programState.evaluatorRunning 1== 0) {
                clearInterval(programState.evaluatorRunning);
                programState.evaluatorRunning == 0;
            }
        }
    }
});
