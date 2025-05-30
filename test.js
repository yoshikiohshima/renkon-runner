class RecordsWriter {
    writeRecords(url, records) {
        if (!url.endsWith("/")) {
            url = url + "/";
        }
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

const recordsWriter = new RecordsWriter();

const maybeBaseURL = "https://substrate-3533.local/events;data=substrate-bootstrap-dev121";

recordsWriter.writeRecords(maybeBaseURL, [{fields: {path: "/programs/a", program: "x"}}]);

/*
  env NODE_TLS_REJECT_UNAUTHORIZED=0 node test.js
*/
