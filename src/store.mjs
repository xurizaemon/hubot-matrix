import { MemoryStore } from 'matrix-js-sdk/lib/store/memory.js';

export default class Store extends MemoryStore {

    constructor(localStorage) {
        super();
        this._localStorage = localStorage;
        this.syncToken = null;
        this.saveDirty = false;
    }

    getSyncToken() {
        return this.syncToken;
    }

    getSavedSyncToken() {
        return Promise.resolve(this._localStorage.getItem('sync_token') || null);
    }

    setSyncToken(token) {
        this.saveDirty = this.saveDirty || this.syncToken !== token;
        this.syncToken = token;
    }

    save(force) {
        this._localStorage.setItem('sync_token', this.syncToken);
        return Promise.resolve();
    }

    wantsSave() {
        return this.saveDirty;
    }
}
