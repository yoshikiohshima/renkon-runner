import {createEventSource} from "eventsource-client";

export class EventSource {
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

export class RecordsWriter {
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

