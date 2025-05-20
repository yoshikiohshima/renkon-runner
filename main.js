import express from "express";
import cors from "cors";
import {spawn} from "child_process";

const app = express();
app.use(cors());

const processes = new Map();

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
            child.stdout.pipe(process.stdout);
            resolve(child);
        });
    });
}

function send(process, code) {
    process.stdin.cork();
    process.stdin.write(JSON.stringify(code), "utf-8");
    process.stdin.uncork();
}
   
app.post("/upload", async (req, res) => {
    const code = req.body.code;
    const name = req.body.name || "main";

    if (Array.isArray(code)) {
        let process = processes.get(name);
        if (!process) {
            process = await newProcess();
            processes.set(name, process);
        }
        send(process, code);
    }
    return res.status(200).end(JSON.stringify({message: "code received"}));
});

app.get("/list", async (req, res) => {
    console.log(JSON.stringify([...processes.keys()]));
    res.json({names: [...processes.keys()]});
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

app.listen(port, () => {
    console.log(`⚡️[bootup]: Server is running at port: ${port}`)})
