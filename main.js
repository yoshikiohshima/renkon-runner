import {ProgramState} from "renkon-core";
import {createEventSource} from "eventsource-client";

import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

class EventSource {
    constructor(url) {
        this.callback = null;
        this.es = createEventSource({
            url: url,
            onMessage: (data) => {
                if (this.callback) {
                    this.callback(data);
                }
            }
        });
    }
    addEventListener(eventType, callback) {
        this.callback = callback;
    }
    removeEventListener(eventType, callback) {
        this.callback = null;
    }
    close() {
        if (this.es) {
            this.es.close();
        }
    }
}

class RecordsWriter {
    writeRecords(url, records) {
        if (!url.endsWith("/")) {
            url = url + "/";
        }
        console.log("write", url, records);
        return fetch(url, {
            method: 'POST', body: JSON.stringify({
                command: "events:write",
                parameters: {
                    "events": records,
                }
            })
        });
    }
}

const bindings = {
    EventSource,
    RecordsWriter
};

const programState = new ProgramState(Date.now(), bindings);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
  
app.post("/upload", async (req, res) => {
    const code = req.body.code;
    const path = req.body.path || "main";
    if (Array.isArray(code)) {
        programState.setupProgram(code, path);
        programState.nodeEvaluator();
    }
    return res.status(200).send({ message: "code received" });
});

const port = process.env.PORT || 2345;

app.listen(port, () => {
    console.log(`⚡️[bootup]: Server is running at port: ${port}`)})
