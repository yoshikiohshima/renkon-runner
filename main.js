import express from "express";
import cors from "cors";
import {spawn} from "child_process";

const app = express();
app.use(cors());

const processes = new Map();

const outputResponses = new Map(); // [name, [respons]]
// const outputRequests = new Map(); // [name, {request, response}]

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function newProcess() {
    const child = spawn(
        process.argv[0],
        [
//            "--inspect-brk",
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
        const array = outputResponses.get(name);
        if (!array) {return;}
        for (const entries of array) {
            // console.log("sending", result);
            entries.response.write(result);
        }
    });
}

function send(process, code) {
    process.stdin.cork();
    process.stdin.write(JSON.stringify(code), "utf-8");
    process.stdin.uncork();
}

app.post("/run", async (req, res) => {
    const code = req.body.code;
    const name = req.body.name || "main";

    if (Array.isArray(code)) {
        let process = processes.get(name);
        if (!process) {
            process = await newProcess();
            processes.set(name, process);
            setOutput(name, process);
        }
        send(process, code);
    }
    return res.status(200).end(JSON.stringify({message: "code received"}));
});

app.post("/stop", async (req, res) => {
    if (!req.body.name) {res.end("no body");}
    const name = req.body.name || "main";
    console.log("stop", name);
    const process = processes.get(name);
    if (process) {
        process.kill("SIGTERM");
    }
    processes.delete(name);
    const array = outputResponses.get(name);
    if (array) {
        for (const entry of array) {
            entry.response.end("closed");
        }
        outputResponses.delete(name);
    }
    res.end("done");
});

app.get("/list", async (req, res) => {
    console.log(JSON.stringify([...processes.keys()]));
    res.json({names: [...processes.keys()]});
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

