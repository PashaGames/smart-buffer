import SmartBuffer from './smart-buffer';

/**
 * Performs a test and returns the test case function
 * @param {string} name 
 * @param {(v: number|string) => void} writer 
 * @param {() => number|string} reader
 * @param {number|string} expected 
 * @returns {() => void}
 */
const test = (name, writer, reader, expected) => {
    writer(expected);

    return () => {
        const v = reader(); 
        if (v != expected) console.warn(`'${name}' failed; value '${v}' - expected '${expected}'`);
        else console.log(`"${name}" passed; value '${v}' - expected '${expected}'`)
    }
}

const limits = {
	i8: 0x7f,
	u8: 0xff,
	i16: 0x7fff,
	u16: 0xffff,
	i32: 0x7fffffff,
	u32: 0xffffffff
};

const values = {
	i8: limits.i8 - 1,
	u8: limits.u8 - 2,
	i16: limits.i16 - 3,
	u16: limits.u16 - 4,
	i32: limits.i32 - 5,
	u32: limits.u32 - 6,
	s: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!"£$%^&*()',
	es: decodeURI(atob('JUYwJTlGJTk4JThB')) /* smile emoji */
};

console.time('SmartBuffer test');

const sb = SmartBuffer.fromSize(0);

const tests = [
    test('i8', sb.writeInt8.bind(sb), sb.readInt8.bind(sb), values.i8),
    test('u8', sb.writeUInt8.bind(sb), sb.readUInt8.bind(sb), values.u8),
    test('i16 be', sb.writeInt16BE.bind(sb), sb.readInt16BE.bind(sb), values.i16),
    test('i16 le', sb.writeInt16LE.bind(sb), sb.readInt16LE.bind(sb), values.i16),
    test('i32 be', sb.writeInt32BE.bind(sb), sb.readInt32BE.bind(sb), values.i32),
    test('i32 le', sb.writeInt32LE.bind(sb), sb.readInt32LE.bind(sb), values.i32),
    test('u32 be', sb.writeUInt32BE.bind(sb), sb.readUInt32BE.bind(sb), values.u32),
    test('u32 le', sb.writeUInt32LE.bind(sb), sb.readUInt32LE.bind(sb), values.u32),
    test('nt u8 string', (v) => sb.writeStringNT(v, 'utf8'), () => sb.readStringNT('utf8'), values.s),
    test('nt u16 string', (v) => sb.writeStringNT(v, 'utf16'), () => sb.readStringNT('utf16'), values.s),
    test('nt escaped u8 string', (v) => sb.writeEscapedStringNT(v, 'utf8'), () => sb.readEscapedStringNT('utf8'), values.es),
    test('nt u8 string [2]', (v) => sb.writeStringNT(v, 'utf8'), () => sb.readStringNT('utf8'), 'gamer'),
    test('u16 string', (v) => sb.writeString(v, 'utf16'), () => sb.readString('utf16'), 'gamer'),
];

sb.offset = 0;

tests.forEach((test) => test());

console.timeEnd('SmartBuffer test');