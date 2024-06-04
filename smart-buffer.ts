/**
*** @author Aero
*** @version 0.0.2
**/

// Callbacks for reader operations [arg1: DataView, arg2: byteOffset, arg3?: littleEndian]
const readers = {
    i8: DataView.prototype.getInt8,
    u8: DataView.prototype.getUint8,
    i16: DataView.prototype.getInt16,
    u16: DataView.prototype.getUint16,
    i32: DataView.prototype.getInt32,
    u32: DataView.prototype.getUint32,
};

// Callbacks for writer operations [arg1: DataView, arg2: byteOffset, arg3: value, arg4?: littleEndian]
const writers = {
    i8: DataView.prototype.setInt8,
    u8: DataView.prototype.setUint8,
    i16: DataView.prototype.setInt16,
    u16: DataView.prototype.setUint16,
    i32: DataView.prototype.setInt32,
    u32: DataView.prototype.setUint32,
};

/**
 * Wrapper to call arbitrary read functions
 *
 * @protected
 */
const readAux = (
    buffer: SmartBuffer,
    callback: Function,
    valueSize: number,
    littleEndian?: boolean | null,
    byteOffset?: number | null,
): number => {
    if (typeof byteOffset !== 'number') {
        byteOffset = buffer.offset;
        buffer.offset += valueSize;
    }

    const result = callback.call(
        buffer.view,
        byteOffset,
        littleEndian,
    ) as number;
    return result;
};

/**
 * Wrapper to call arbitrary write functions
 *
 * @protected
 */
const writeAux = (
    buffer: SmartBuffer,
    callback: Function,
    value: number,
    valueSize: number,
    littleEndian?: boolean | null,
    byteOffset?: number | null,
) => {
    ensureCapacity(buffer, valueSize);

    if (typeof byteOffset !== 'number') {
        byteOffset = buffer.offset;
        buffer.offset += valueSize;
    }

    void callback.call(buffer.view, byteOffset, value, littleEndian);
};

/**
 * Ensures the internal buffer has `size` free
 *
 * @protected
 */
const ensureCapacity = (buffer: SmartBuffer, size: number) => {
    const newSize = buffer.offset + size;

    if (newSize > buffer.length) {
        const newBuffer = new ArrayBuffer(newSize);

        const view = new Uint8Array(newBuffer);
        view.set(new Uint8Array(buffer.toBuffer()));

        buffer.view = new DataView(newBuffer);
    }
};

export type Encoding = 'utf8' | 'ut16';

const stringReaders = {
    /**
     * Reads a *(null terminated)* utf-8 string.
     *
     * @param {SmartBuffer} buffer SmartBuffer instance to read from.
     * @param {number?} [byteOffset] Optional offset to read from.
     * @param {boolean} nt Whether or not to read until null-terminator is met.
     * @returns {string} The value read.
     */
    utf8: (
        buffer: SmartBuffer,
        byteOffset?: number | null,
        nt: boolean = false,
    ): string => {
        const l = buffer.length;

        let i = typeof byteOffset === 'number' ? byteOffset : buffer.offset;

        let result = '';

        for (; i < l; i++) {
            const ch = readers.u8.call(buffer.view, i);
            if (nt && ch === 0) {
                if (typeof byteOffset !== 'number') buffer.offset = i + 1;
                return result; // fast path
            }
            result += String.fromCharCode(ch);
        }

        return result; // slow path
    },

    /**
     * Reads a *(null terminated)* utf-16 string.
     *
     * @param {SmartBuffer} buffer SmartBuffer instance to read from.
     * @param {number?} [byteOffset] Optional offset to read from.
     * @param {boolean} nt Whether or not to read until null-terminator is met.
     * @returns {string} The value read.
     */
    utf16: (
        buffer: SmartBuffer,
        byteOffset?: number | null,
        nt: boolean = false,
    ) => {
        const l = buffer.length;

        let i = typeof byteOffset === 'number' ? byteOffset : buffer.offset;

        let result = '';

        for (; i < l - 1; i += 2) {
            const ch = readers.u16.call(buffer.view, i);
            if (nt && ch === 0) {
                if (typeof byteOffset !== 'number') buffer.offset = i + 2;
                return result; // fast path
            }
            result += String.fromCharCode(ch);
        }

        return result; // slow path
    },
};

const stringWriters = {
    /**
     * Writes a *(null terminated)* utf-8 string.
     *
     * @param {SmartBuffer} buffer SmartBuffer instance to written to.
     * @param {string} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to write to.
     */
    utf8: (buffer: SmartBuffer, value: string, byteOffset?: number | null) => {
        const l = value.length;
        ensureCapacity(buffer, l);

        if (typeof byteOffset !== 'number') {
            byteOffset = buffer.offset;
            buffer.offset += l;
        }

        for (let i = 0; i < l; i++) {
            // optimization
            writers.u8.call(buffer.view, byteOffset + i, value.charCodeAt(i));
        }
    },

    /**
     * Writes a *(null terminated)* utf-16 string.
     *
     * @param {SmartBuffer} buffer SmartBuffer instance to written to.
     * @param {string} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to write to.
     */
    utf16: (buffer: SmartBuffer, value: string, byteOffset?: number | null) => {
        const l = value.length;
        ensureCapacity(buffer, l * 2);

        if (typeof byteOffset !== 'number') {
            byteOffset = buffer.offset;
            buffer.offset += l * 2;
        }

        for (let i = 0; i < l; i++) {
            // optimization
            writers.u16.call(
                buffer.view,
                byteOffset + i * 2,
                value.charCodeAt(i),
            );
        }
    },
};

export default class SmartBuffer {
    view: DataView;

    offset: number;

    /**
     *
     * @param {ArrayBuffer|DataView} viewOrBuffer
     * @param {number?} [offset]
     */
    constructor(viewOrBuffer: ArrayBuffer | DataView, offset?: number | null) {
        if (viewOrBuffer instanceof DataView) {
            this.view = viewOrBuffer;
        } else {
            if (!(viewOrBuffer instanceof ArrayBuffer)) {
                throw new TypeError(
                    'First argument to SmartBuffer constructor must be an ArrayBuffer or DataView',
                );
            }

            this.view = new DataView(viewOrBuffer);
        }

        this.offset = offset ?? 0;
    }

    /**
     * Creates a SmartBuffer instance with the specified size.
     *
     * @param {number} size
     * @returns {SmartBuffer}
     */
    static fromSize(size: number): SmartBuffer {
        return new this(new ArrayBuffer(size), 0);
    }

    /**
     * Creates a SamrtBuffer instance from a `ArrayBuffer`.
     *
     * @param {ArrayBuffer} buffer
     * @param {number?} [byteOffset]
     * @returns {SmartBuffer}
     */
    static fromBuffer(buffer: ArrayBuffer, byteOffset?: number | null) {
        return new this(buffer, byteOffset);
    }

    /**
     * The internal buffer of the current SmartBuffer instance.
     *
     * @note Returns `null` if the internal view is `null`.
     * @returns {ArrayBuffer?}
     */
    get buffer(): ArrayBuffer | null {
        const { view } = this;
        return view != null ? view.buffer : null;
    }

    /**
     * The buffer for the internal view of the current SmartBuffer instance.
     *
     * @note Wrapper function for `this.buffer`.
     * @returns {ArrayBuffer}
     */
    toBuffer(): ArrayBuffer {
        return this.buffer;
    }

    /**
     * The length of the internal view for the current SmartBuffer instance.
     *
     * @note Returns `0` if the internal view is `null`.
     * @returns {number}
     */
    get length(): number {
        const { view } = this;
        return view != null ? view.byteLength : 0;
    }

    /** @returns {boolean} Whether or not EOF has been met. */
    get eof(): boolean {
        return this.offset >= this.length;
    }

    /**
     * Reads a Int8 value from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readInt8(byteOffset?: number | null) {
        return readAux(this, readers.i8, 1, undefined, byteOffset);
    }

    /**
     * Reads a UInt8 from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readUInt8(byteOffset?: number | null) {
        return readAux(this, readers.u8, 1, undefined, byteOffset);
    }

    /**
     * Reads a Int16LE from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readInt16LE(byteOffset?: number | null) {
        return readAux(this, readers.i16, 2, true, byteOffset);
    }

    /**
     * Reads a Int16BE from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readInt16BE(byteOffset?: number | null) {
        return readAux(this, readers.i16, 2, false, byteOffset);
    }

    /**
     * Reads a UInt16LE from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readUInt16LE(byteOffset?: number | null) {
        return readAux(this, readers.u16, 2, true, byteOffset);
    }

    /**
     * Reads a UInt16BE from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readUInt16BE(byteOffset?: number | null) {
        return readAux(this, readers.u16, 2, false, byteOffset);
    }

    /**
     * Reads a Int32LE from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readInt32LE(byteOffset?: number | null) {
        return readAux(this, readers.i32, 4, true, byteOffset);
    }

    /**
     * Reads a Int32BE from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readInt32BE(byteOffset?: number | null) {
        return readAux(this, readers.i32, 4, false, byteOffset);
    }

    /**
     * Reads a UInt32LE from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readUInt32LE(byteOffset?: number | null) {
        return readAux(this, readers.u32, 4, true, byteOffset);
    }

    /**
     * Reads a UInt32BE from the internal view.
     *
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns The value read.
     */
    readUInt32BE(byteOffset?: number | null) {
        return readAux(this, readers.u32, 4, false, byteOffset);
    }

    /**
     * Reads a string until EOF.
     *
     * @param {Encoding} encoding Encoding to be used.
     * @param {number?} [byteOffset] Optional offset to be read from.
     */
    readString(encoding: Encoding = 'utf8', byteOffset?: number | null) {
        return stringReaders[encoding](this, byteOffset, false);
    }

    /**
     * Reads a null-terminated string.
     *
     * @param {Encoding} encoding Encoding to be used.
     * @param {number?} [byteOffset] Optional offset to be read from.
     */
    readStringNT(encoding: Encoding = 'utf8', byteOffset?: number | null) {
        return stringReaders[encoding](this, byteOffset, true);
    }

    /**
     * Reads a null-terminated escaped string.
     *
     * @note If a null-terminator is not met - reads until EOF.
     * @param {Encoding} encoding Encoding to be used.
     * @param {number?} [byteOffset] Optional offset to be read from.
     * @returns {string} The value read.
     */
    readEscapedStringNT(
        encoding: Encoding = 'utf8',
        byteOffset?: number | null,
    ) {
        return decodeURIComponent(
            escape(this.readStringNT(encoding, byteOffset)),
        );
    }

    /**
     * Writes a Int8 to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeInt8(value: number, byteOffset?: number | null) {
        writeAux(this, writers.i8, value, 1, undefined, byteOffset);
    }

    /**
     * Writes a UInt8 to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeUInt8(value: number, byteOffset?: number | null) {
        writeAux(this, writers.u8, value, 1, undefined, byteOffset);
    }

    /**
     * Writes a Int16LE to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeInt16LE(value: number, byteOffset?: number | null) {
        writeAux(this, writers.i16, value, 2, true, byteOffset);
    }

    /**
     * Writes a Int16BE to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeInt16BE(value: number, byteOffset?: number | null) {
        writeAux(this, writers.i16, value, 2, false, byteOffset);
    }

    /**
     * Writes a UInt16LE to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeUInt16LE(value: number, byteOffset?: number | null) {
        writeAux(this, writers.u16, value, 2, true, byteOffset);
    }

    /**
     * Writes a UInt16BE to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeUInt16BE(value: number, byteOffset?: number | null) {
        writeAux(this, writers.u16, value, 2, false, byteOffset);
    }

    /**
     * Writes a Int32LE to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeInt32LE(value: number, byteOffset?: number | null) {
        writeAux(this, writers.i32, value, 4, true, byteOffset);
    }

    /**
     * Writes a Int32BE to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeInt32BE(value: number, byteOffset?: number | null) {
        writeAux(this, writers.i32, value, 4, false, byteOffset);
    }

    /**
     * Writes a UInt32LE to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeUInt32LE(value: number, byteOffset?: number | null) {
        writeAux(this, writers.u32, value, 4, true, byteOffset);
    }

    /**
     * Writes a UInt32BE to the internal view.
     *
     * @param {number} value Value to be written.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeUInt32BE(value: number, byteOffset?: number | null) {
        writeAux(this, writers.u32, value, 4, false, byteOffset);
    }

    /**
     * Writes a string to the internal view.
     *
     * @param {string} value Value to be written.
     * @param {Encoding} encoding Encoding to be used.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeString(
        value: string,
        encoding: Encoding = 'utf8',
        byteOffset?: number | null,
    ) {
        stringWriters[encoding](this, value, byteOffset);
    }

    /**
     * Writes a null-terminated string to the internal view.
     *
     * @param {string} value Value to be written.
     * @param {Encoding} encoding Encoding to be used.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeStringNT(
        value: string,
        encoding: Encoding = 'utf8',
        byteOffset?: number | null,
    ) {
        stringWriters[encoding](this, value, byteOffset);
        if (encoding === 'utf8') this.writeUInt8(0);
        else this.writeUInt16LE(0);
    }

    /**
     * Writes a escaped utf-8 string to the internal view.
     *
     * @param {string} value Value to be written.
     * @param {Encoding} encoding Encoding to be used.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeEscapedString(
        value: string,
        encoding: Encoding = 'utf8',
        byteOffset?: number | null,
    ) {
        this.writeString(
            unescape(encodeURIComponent(value)),
            encoding,
            byteOffset,
        );
    }

    /**
     * Writes a escaped null-terminator utf-8 string to the internal view.
     *
     * @param {string} value Value to be written.
     * @param {Encoding} encoding Encoding to be used.
     * @param {number?} [byteOffset] Optional offset to be written to.
     */
    writeEscapedStringNT(
        value: string,
        encoding: Encoding = 'utf8',
        byteOffset?: number | null,
    ) {
        this.writeStringNT(
            unescape(encodeURIComponent(value)),
            encoding,
            byteOffset,
        );
    }
};