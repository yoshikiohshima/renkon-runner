import {ProgramState} from "renkon-core";

import {EventSource, RecordWriter} from "./record.js";

const bindings = {
    EventSource,
    RecordsWriter
};

const programState = new ProgramState(Date.now(), bindings);

process.stdin.on("data", (chunk) => {
    const array = JSON.parse(chunk.toString());
    programState.setupProgram(array);
    programState.nodeEvaluator();
});
