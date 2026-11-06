import type { IncomingMessage, Server } from 'node:http';
import type { Socket } from 'node:net';
import { upload_error } from './upload_error';

/** One backpressured network chunk + the current file only. Never buffer the full upload. */
export class UploadReader {
    private chunk: Buffer = Buffer.alloc(0);
    private offset = 0;
    private received = 0;
    private ended = false;
    private failure: Error | undefined;
    private wake: (() => void) | undefined;
    private timer: ReturnType<typeof setTimeout>;
    private idleTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly deadline: number;
    private readonly onReadable = () => this.wake?.();
    private readonly onEnd = () => { this.ended = true; this.wake?.(); };
    private readonly onError = () => { this.failure = new Error('Upload connection interrupted'); this.wake?.(); };
    private readonly onClose = () => { if (!this.request.complete) this.onError(); };

    constructor(private request: IncomingMessage, private maximum: number, absolute: number, private idle: number, extendNodeTimeout = false) {
        this.deadline = Date.now() + absolute;
        // Node's default whole-request deadline is five minutes, independent of
        // req.setTimeout's idle timer. Only with explicit operator opt-in raise that
        // server-wide ceiling; preserve disabled/longer operator settings.
        // The per-upload absolute + idle timers below remain authoritative and bounded.
        const server = (request.socket as Socket & { server?: Server }).server;
        if (extendNodeTimeout && server && server.requestTimeout > 0 && server.requestTimeout < absolute) server.requestTimeout = absolute;
        this.timer = setTimeout(() => this.timeout(), absolute);
        request.on('readable', this.onReadable);
        request.on('end', this.onEnd);
        request.on('error', this.onError);
        request.on('aborted', this.onError);
        request.on('close', this.onClose);
        request.setTimeout(idle, this.onTimeout);
        this.resetIdle();
    }

    private onTimeout = () => this.timeout();
    private timeout() { this.failure = new Error('Upload timed out'); this.wake?.(); }
    private resetIdle() { clearTimeout(this.idleTimer); this.idleTimer = setTimeout(() => this.timeout(), this.idle); }
    check() {
        if (Date.now() >= this.deadline) this.timeout();
        if (this.failure) upload_error(this.failure.message === 'Upload timed out' ? 408 : 400, this.failure.message);
        if (this.request.aborted) upload_error(400, 'Upload connection interrupted');
    }
    setExpected(total: number) {
        if (total > this.maximum || this.received > total) upload_error(413, 'Upload exceeds declared size');
        this.maximum = total;
    }
    private async next(): Promise<boolean> {
        while (true) {
            this.check();
            const chunk: Buffer | null = this.request.read();
            if (chunk !== null) {
                this.received += chunk.length;
                if (this.received > this.maximum) upload_error(413, 'Upload exceeds declared size');
                this.chunk = chunk; this.offset = 0; this.resetIdle();
                return true;
            }
            if (this.ended || this.request.readableEnded) return false;
            await new Promise<void>(resolve => { this.wake = resolve; });
            this.wake = undefined;
        }
    }
    async take(maximum: number): Promise<Buffer> {
        this.check();
        if (this.offset === this.chunk.length && !await this.next()) upload_error(400, 'Truncated upload');
        const length = Math.min(maximum, this.chunk.length - this.offset);
        const result = this.chunk.subarray(this.offset, this.offset + length);
        this.offset += length;
        return result;
    }
    async bytes(length: number): Promise<Buffer> {
        const result = Buffer.allocUnsafe(length);
        let at = 0;
        while (at < length) { const chunk = await this.take(length - at); chunk.copy(result, at); at += chunk.length; }
        return result;
    }
    async eof() {
        this.check();
        if (this.offset !== this.chunk.length || await this.next()) upload_error(400, 'Unexpected upload bytes');
        if (this.received !== this.maximum) upload_error(400, 'Truncated upload');
        clearTimeout(this.idleTimer); this.request.setTimeout(0);
    }
    dispose() {
        clearTimeout(this.timer); clearTimeout(this.idleTimer);
        this.request.setTimeout(0); this.request.off('timeout', this.onTimeout);
        this.request.off('readable', this.onReadable); this.request.off('end', this.onEnd);
        this.request.off('error', this.onError); this.request.off('aborted', this.onError); this.request.off('close', this.onClose);
    }
}
