import express from "express";
import cors from "cors";
import {spawn} from "child_process";

import {EventSource,  RecordsWriter} from "./record.js";
import {loadRenkon} from "./loadRenkon.js";

const app = express();
app.use(cors());

const processes = new Map();
const outputResponses = new Map(); // [name, [response]]
const status = new Map(); // [name, string]

const logs = new Map(); // [name, string]

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* the status for a server side program is keyed by a name
   if it is under the control of this server, it has an entry in processes
   if it is under the control of this server, it has an entry in processes
   status is running or paused

   - /add: put a program under server's control. instantiate if the process for this name
     does not exist. Send program to the process.
   - /remove kill the process if it exists.

   - /start send message to tell the process to start ticking
   - /stop send message to tell the process to stop ticking
*/
   
function newProcess() {
    const child = spawn(
        process.argv[0],
        [
            // "--inspect-brk",
            "child.js"
        ],
        {
            env: {"NODE_TLS_REJECT_UNAUTHORIZED": "0"},
            stdio: "pipe",
            detached: true,
        }
    );

    return new Promise((resolve) => {
        child.on("spawn", (_message) => {
            resolve(child);
        });
    });
}

function setOutput(name, child) {
    // child.stdout.pipe(process.stdout);
    child.stdout.on("data", (chunk) => {
        const result = chunk.toString();
        // console.log("result", result);
        let logArray = logs.get(name);
        if (!logArray) {
            logArray = [];
            logs.set(name, logArray);
        }
        logArray.push(result);
    });
    child.stderr.on("data", (chunk) => {
        const result = chunk.toString();
        console.log("error", result);
    });
}

function sendOutput() {
    // console.log("sendoutput");
    for (const name of logs.keys()) {
        const log = logs.get(name);
        if (log.length === 0) {continue;}
        const array = outputResponses.get(name);
        if (!array) {continue;}
        for (const entries of array) {
            // console.log("sending", log.join(""));
            entries.response.write(log.join(""));
        }
        logs.set(name, []);
    }
}

setInterval(sendOutput, 1000);

function send(process, data) {
    console.log("send", data);
    
    process.stdin.cork();
    process.stdin.write(JSON.stringify(data) + "\n", "utf-8");
    process.stdin.uncork();
}

app.post("/add", async (req, res) => {
    const data = req.body.data;
    const name = req.body.name;

    if (!name || !data) {
        return res.end("no body");
    }

    const loaded = loadRenkon(data);
    if (loaded.code) {
        const code = [...loaded.code].filter(([id, code]) => loaded.windowEnabled.map.get(id).enabled)
          .map(([_id, code]) => code);
        let process = processes.get(name);
        if (!process) {
            process = await newProcess();
            processes.set(name, process);
            console.log("added proc", name);
            setOutput(name, process);
            status.set(name, "pause");
        }
        send(process, {message: "add", code: code});
    }
    console.log("add", name);
    return res.status(200).end(JSON.stringify({message: "code received"}));
});

app.post("/remove", async (req, res) => {
    const name = req.body.name;
    if (!name) {res.end("no name");}
    const process = processes.get(name);
    if (process) {
        process.kill("SIGTERM");
    }
    processes.delete(name);
    status.delete(name);
    const array = outputResponses.get(name);
    if (array) {
        for (const entry of array) {
            entry.response.end("closed");
        }
        outputResponses.delete(name);
    }
    console.log("remove", name);
    res.end("done");
});

app.post("/status", async (req, res) => {
    const name = req.body.name;
    const status = req.body.status;
    // if status is a string, that is used to change the status. otherwise it is
    // a query to see the current value.

    if (!name) {return res.end("no name");}
    const process = processes.get(name);
    if (!process) {return res.end("no process to start");}

    if (status) {
        send(process, {status});
        return res.status(200).end(JSON.stringify({message: "program status changed:", status}));
    }
    return res.status(200).end(JSON.stringify({message: "program status"}));
});

app.get("/list", async (req, res) => {
    console.log(JSON.stringify([...processes.keys()]));
    res.json({status: [...processes.keys()].map((k) => ({name: k, status: status.get(k)}))});
});

app.get("/stdout/:name", async (req, res) => {
    const name = req.params.name;
    if (!name) {res.end("no name specified"); return;}
    res.setHeader("Connection", "keep-alive");
    res.writeHead(200);
    res.write("start output");
    let array = outputResponses.get(name);
    if (!array) {
        array = [];
        outputResponses.set(name, array);
    }
    array.push({request: req, response: res});

    req.on("close", () => {
        const entries = outputResponses.get(name);
        if (!entries) {return;}
        const newEntries = entries.filter(({request, responses}) => request !== req);
        // console.log("close", entries.length, newEntries.length);
        outputResponses.set(name, newEntries);
    });
});

// process.on("exit", () => console.log("I am exiting"));
process.on('SIGINT', () => {
    console.log("I got SIGINT");
    for (const [name, process] of processes) {
        process.kill("SIGTERM")
    };
    process.exit();
});

const port = process.env.PORT || 2345;

const server = app.listen(port, () => {
    console.log(`⚡️[bootup]: Server is running at port: ${port}`)});

server.keepAliveTimeout = 60 * 1000;
server.headersTimeout = 60 * 1000;

function getProgramsFromStore(baseURL) {
    const url = new URL(`${baseURL}/stream/events`);

    const programsQuery = {
        programs: {
            view_criteria: {
                where: {
                    path: [{compare: "like", value: "/programs/%"}],
                },
            },
            view: "group-by-path-max-id",
        }
    }
    
    url.searchParams.set("querysetjson", JSON.stringify(programsQuery));
    return fetch(url.toString());
}

const maybeBaseURL = process.argv[process.argv.length - 1];

if (maybeBaseURL.startsWith("http")) {
    getProgramsFromStore(maybeBaseURL).then((records) => {
         return records.json();
    }).then((json) => {
        const programs = json.programs;
        for (const program of programs) {
            console.log(program.fields);
            const path = program.fields.path;
            const slash = path.indexOf("/");
            const progName = slash >= 0 ? path.slice(0, slash) : undefined;
            /*
            const code = program.fields.code;
            if (code) {
            }*/
        }
    });
}

// const recordsWriter = new RecordsWriter();

/*

const qsA = {
    programs: {
        view_criteria: {
            where: {
                path: [{compare: "like", value: "/programs/%"}],
            },
        },
        view: "group-by-path-max-id",
    }
}

////

// If Accept: text/event-stream, then it gives a streaming result
// Otherwise returns a single response

const url = new URL(`${recordstorebaseurl}/stream/events`)
url.searchParams.set("querysetjson", JSON.stringify(qsA))
fetch(url.toString())

https://substrate-3533.local/events;data=substrate-bootstrap-dev121

env NODE_TLS_REJECT_UNAUTHORIZED=0 node main.js "https://substrate-3533.local/events;data=substrate-bootstrap-dev121"


*/

