import * as $wcm from '../../componentModel';
import type { u64, option, u32, result } from '../../componentModel';
import { wall_clock } from '../clocks/main';
import { streams } from '../io/main';

export namespace filesystem {
    type input_stream = streams.input_stream;
    type output_stream = streams.output_stream;

    type datetime = wall_clock.datetime;

    /**
     * File size or length of a region within a file.
     */
    export type filesize = u64;

    /**
     * The type of a filesystem object referenced by a descriptor.
     *
     * Note: This was called `filetype` in earlier versions of WASI.
     */
    export enum descriptor_type {
    	/**
         * The type of the descriptor or file is unknown or is different from
         * any of the other types specified.
         */
    	unknown = 0,

    	/**
         * The descriptor refers to a block device inode.
         */
    	block_device = 1,

    	/**
         * The descriptor refers to a character device inode.
         */
    	character_device = 2,

    	/**
         * The descriptor refers to a directory inode.
         */
    	directory = 3,

    	/**
         * The descriptor refers to a named pipe.
         */
    	fifo = 4,

    	/**
         * The file refers to a symbolic link inode.
         */
    	symbolic_link = 5,

    	/**
         * The descriptor refers to a regular file inode.
         */
    	regular_file = 6,

    	/**
         * The descriptor refers to a socket.
         */
    	socket = 7,
    }

    /**
     * Descriptor flags.
     *
     * Note: This was called `fdflags` in earlier versions of WASI.
     */
    export interface descriptor_flags extends $wcm.JFlags {
    	/**
         * Read mode: Data can be read.
         */
    	read: boolean;

    	/**
         * Write mode: Data can be written to.
         */
    	write: boolean;

    	/**
         * Request that writes be performed according to synchronized I/O file
         * integrity completion. The data stored in the file and the file's
         * metadata are synchronized. This is similar to `O_SYNC` in POSIX.
         *
         * The precise semantics of this operation have not yet been defined for
         * WASI. At this time, it should be interpreted as a request, and not a
         * requirement.
         */
    	file_integrity_sync: boolean;

    	/**
         * Request that writes be performed according to synchronized I/O data
         * integrity completion. Only the data stored in the file is
         * synchronized. This is similar to `O_DSYNC` in POSIX.
         *
         * The precise semantics of this operation have not yet been defined for
         * WASI. At this time, it should be interpreted as a request, and not a
         * requirement.
         */
    	data_integrity_sync: boolean;

    	/**
         * Requests that reads be performed at the same level of integrety
         * requested for writes. This is similar to `O_RSYNC` in POSIX.
         *
         * The precise semantics of this operation have not yet been defined for
         * WASI. At this time, it should be interpreted as a request, and not a
         * requirement.
         */
    	requested_write_sync: boolean;

    	/**
         * Mutating directories mode: Directory contents may be mutated.
         *
         * When this flag is unset on a descriptor, operations using the
         * descriptor which would create, rename, delete, modify the data or
         * metadata of filesystem objects, or obtain another handle which
         * would permit any of those, shall fail with `error-code::read-only` if
         * they would otherwise succeed.
         *
         * This may only be set on directories.
         */
    	mutate_directory: boolean;
    }

    /**
     * File attributes.
     *
     * Note: This was called `filestat` in earlier versions of WASI.
     */
    export interface descriptor_stat extends $wcm.JRecord {
    	device: device;

    	inode: inode;

    	type: descriptor_type;

    	link_count: link_count;

    	size: filesize;

    	data_access_timestamp: datetime;

    	data_modification_timestamp: datetime;

    	status_change_timestamp: datetime;
    }

    /**
     * Flags determining the method of how paths are resolved.
     */
    export interface path_flags extends $wcm.JFlags {
    	/**
         * As long as the resolved path corresponds to a symbolic link, it is
         * expanded.
         */
    	symlink_follow: boolean;
    }

    /**
     * Open flags used by `open-at`.
     */
    export interface open_flags extends $wcm.JFlags {
    	/**
         * Create file if it does not exist, similar to `O_CREAT` in POSIX.
         */
    	create: boolean;

    	/**
         * Fail if not a directory, similar to `O_DIRECTORY` in POSIX.
         */
    	directory: boolean;

    	/**
         * Fail if file already exists, similar to `O_EXCL` in POSIX.
         */
    	exclusive: boolean;

    	/**
         * Truncate file to size 0, similar to `O_TRUNC` in POSIX.
         */
    	truncate: boolean;
    }

    /**
     * Permissions mode used by `open-at`, `change-file-permissions-at`, and
     * similar.
     */
    export interface modes extends $wcm.JFlags {
    	/**
         * True if the resource is considered readable by the containing
         * filesystem.
         */
    	readable: boolean;

    	/**
         * True if the resource is considered writable by the containing
         * filesystem.
         */
    	writable: boolean;

    	/**
         * True if the resource is considered executable by the containing
         * filesystem. This does not apply to directories.
         */
    	executable: boolean;
    }

    export namespace filter {
    	export const all = 0;
    	export type all = { readonly case: typeof all } & _common;

    	export const none = 1;
    	export type none = { readonly case: typeof none } & _common;

    	export const some = 2;
    	export type some = { readonly case: typeof some; readonly value: string[] } & _common;

    	export type _ct = typeof all | typeof none | typeof some;
    	export type _vt = string[] | undefined;
        type _common = Omit<VariantImpl, 'case' | 'value'>;
        export function _ctor(c: _ct, v: _vt): filter {
        	return new VariantImpl(c, v) as filter;
        }
        export function _all(): all {
        	return new VariantImpl(all, undefined) as all;
        }
        export function _none(): none {
        	return new VariantImpl(none, undefined) as none;
        }
        export function _some(value: string[]): some {
        	return new VariantImpl(some, value) as some;
        }
        class VariantImpl {
        	private readonly _case: _ct;
        	private readonly _value?: _vt;
        	constructor(c: _ct, value: _vt) {
        		this._case = c;
        		this._value = value;
        	}
        	get case(): _ct {
        		return this._case;
        	}
        	get value(): _vt {
        		return this._value;
        	}
        	all(): this is all {
        		return this._case === filter.all;
        	}
        	none(): this is none {
        		return this._case === filter.none;
        	}
        	some(): this is some {
        		return this._case === filter.some;
        	}
        }
    }
    export type filter = filter.all | filter.none | filter.some;

    /**
     * Access type used by `access-at`.
     */
    export namespace access_type {
    	/**
         * Test for readability, writeability, or executability.
         */
    	export const access = 0;
    	export type access = { readonly case: typeof access; readonly value: modes } & _common;

    	/**
         * Test whether the path exists.
         */
    	export const exists = 1;
    	export type exists = { readonly case: typeof exists } & _common;

    	export type _ct = typeof access | typeof exists;
    	export type _vt = modes | undefined;
        type _common = Omit<VariantImpl, 'case' | 'value'>;
        export function _ctor(c: _ct, v: _vt): access_type {
        	return new VariantImpl(c, v) as access_type;
        }
        export function _access(value: modes): access {
        	return new VariantImpl(access, value) as access;
        }
        export function _exists(): exists {
        	return new VariantImpl(exists, undefined) as exists;
        }
        class VariantImpl {
        	private readonly _case: _ct;
        	private readonly _value?: _vt;
        	constructor(c: _ct, value: _vt) {
        		this._case = c;
        		this._value = value;
        	}
        	get case(): _ct {
        		return this._case;
        	}
        	get value(): _vt {
        		return this._value;
        	}
        	access(): this is access {
        		return this._case === access_type.access;
        	}
        	exists(): this is exists {
        		return this._case === access_type.exists;
        	}
        }
    }
    export type access_type = access_type.access | access_type.exists;

    /**
     * Number of hard links to an inode.
     */
    export type link_count = u64;

    /**
     * Identifier for a device containing a file system. Can be used in
     * combination with `inode` to uniquely identify a file or directory in
     * the filesystem.
     */
    export type device = u64;

    /**
     * Filesystem object serial number that is unique within its file system.
     */
    export type inode = u64;

    /**
     * When setting a timestamp, this gives the value to set it to.
     */
    export namespace new_timestamp {
    	/**
         * Leave the timestamp set to its previous value.
         */
    	export const no_change = 0;
    	export type no_change = { readonly case: typeof no_change } & _common;

    	/**
         * Set the timestamp to the current time of the system clock associated
         * with the filesystem.
         */
    	export const now = 1;
    	export type now = { readonly case: typeof now } & _common;

    	/**
         * Set the timestamp to the given value.
         */
    	export const timestamp = 2;
    	export type timestamp = { readonly case: typeof timestamp; readonly value: datetime } & _common;

    	export type _ct = typeof no_change | typeof now | typeof timestamp;
    	export type _vt = datetime | undefined;
        type _common = Omit<VariantImpl, 'case' | 'value'>;
        export function _ctor(c: _ct, v: _vt): new_timestamp {
        	return new VariantImpl(c, v) as new_timestamp;
        }
        export function _no_change(): no_change {
        	return new VariantImpl(no_change, undefined) as no_change;
        }
        export function _now(): now {
        	return new VariantImpl(now, undefined) as now;
        }
        export function _timestamp(value: datetime): timestamp {
        	return new VariantImpl(timestamp, value) as timestamp;
        }
        class VariantImpl {
        	private readonly _case: _ct;
        	private readonly _value?: _vt;
        	constructor(c: _ct, value: _vt) {
        		this._case = c;
        		this._value = value;
        	}
        	get case(): _ct {
        		return this._case;
        	}
        	get value(): _vt {
        		return this._value;
        	}
        	no_change(): this is no_change {
        		return this._case === new_timestamp.no_change;
        	}
        	now(): this is now {
        		return this._case === new_timestamp.now;
        	}
        	timestamp(): this is timestamp {
        		return this._case === new_timestamp.timestamp;
        	}
        }
    }
    export type new_timestamp = new_timestamp.no_change | new_timestamp.now | new_timestamp.timestamp;

    /**
     * A directory entry.
     */
    export interface directory_entry extends $wcm.JRecord {
    	inode: option<inode>;

    	type: descriptor_type;

    	name: string;
    }

    /**
     * Error codes returned by functions, similar to `errno` in POSIX.
     * Not all of these error codes are returned by the functions provided by this
     * API; some are used in higher-level library layers, and others are provided
     * merely for alignment with POSIX.
     */
    export enum error_code {
    	/**
         * Permission denied, similar to `EACCES` in POSIX.
         */
    	access = 0,

    	/**
         * Resource unavailable, or operation would block, similar to `EAGAIN` and `EWOULDBLOCK` in POSIX.
         */
    	would_block = 1,

    	/**
         * Connection already in progress, similar to `EALREADY` in POSIX.
         */
    	already = 2,

    	/**
         * Bad descriptor, similar to `EBADF` in POSIX.
         */
    	bad_descriptor = 3,

    	/**
         * Device or resource busy, similar to `EBUSY` in POSIX.
         */
    	busy = 4,

    	/**
         * Resource deadlock would occur, similar to `EDEADLK` in POSIX.
         */
    	deadlock = 5,

    	/**
         * Storage quota exceeded, similar to `EDQUOT` in POSIX.
         */
    	quota = 6,

    	/**
         * File exists, similar to `EEXIST` in POSIX.
         */
    	exist = 7,

    	/**
         * File too large, similar to `EFBIG` in POSIX.
         */
    	file_too_large = 8,

    	/**
         * Illegal byte sequence, similar to `EILSEQ` in POSIX.
         */
    	illegal_byte_sequence = 9,

    	/**
         * Operation in progress, similar to `EINPROGRESS` in POSIX.
         */
    	in_progress = 10,

    	/**
         * Interrupted function, similar to `EINTR` in POSIX.
         */
    	interrupted = 11,

    	/**
         * Invalid argument, similar to `EINVAL` in POSIX.
         */
    	invalid = 12,

    	/**
         * I/O error, similar to `EIO` in POSIX.
         */
    	io = 13,

    	/**
         * Is a directory, similar to `EISDIR` in POSIX.
         */
    	is_directory = 14,

    	/**
         * Too many levels of symbolic links, similar to `ELOOP` in POSIX.
         */
    	loop = 15,

    	/**
         * Too many links, similar to `EMLINK` in POSIX.
         */
    	too_many_links = 16,

    	/**
         * Message too large, similar to `EMSGSIZE` in POSIX.
         */
    	message_size = 17,

    	/**
         * Filename too long, similar to `ENAMETOOLONG` in POSIX.
         */
    	name_too_long = 18,

    	/**
         * No such device, similar to `ENODEV` in POSIX.
         */
    	no_device = 19,

    	/**
         * No such file or directory, similar to `ENOENT` in POSIX.
         */
    	no_entry = 20,

    	/**
         * No locks available, similar to `ENOLCK` in POSIX.
         */
    	no_lock = 21,

    	/**
         * Not enough space, similar to `ENOMEM` in POSIX.
         */
    	insufficient_memory = 22,

    	/**
         * No space left on device, similar to `ENOSPC` in POSIX.
         */
    	insufficient_space = 23,

    	/**
         * Not a directory or a symbolic link to a directory, similar to `ENOTDIR` in POSIX.
         */
    	not_directory = 24,

    	/**
         * Directory not empty, similar to `ENOTEMPTY` in POSIX.
         */
    	not_empty = 25,

    	/**
         * State not recoverable, similar to `ENOTRECOVERABLE` in POSIX.
         */
    	not_recoverable = 26,

    	/**
         * Not supported, similar to `ENOTSUP` and `ENOSYS` in POSIX.
         */
    	unsupported = 27,

    	/**
         * Inappropriate I/O control operation, similar to `ENOTTY` in POSIX.
         */
    	no_tty = 28,

    	/**
         * No such device or address, similar to `ENXIO` in POSIX.
         */
    	no_such_device = 29,

    	/**
         * Value too large to be stored in data type, similar to `EOVERFLOW` in POSIX.
         */
    	overflow = 30,

    	/**
         * Operation not permitted, similar to `EPERM` in POSIX.
         */
    	not_permitted = 31,

    	/**
         * Broken pipe, similar to `EPIPE` in POSIX.
         */
    	pipe = 32,

    	/**
         * Read-only file system, similar to `EROFS` in POSIX.
         */
    	read_only = 33,

    	/**
         * Invalid seek, similar to `ESPIPE` in POSIX.
         */
    	invalid_seek = 34,

    	/**
         * Text file busy, similar to `ETXTBSY` in POSIX.
         */
    	text_file_busy = 35,

    	/**
         * Cross-device link, similar to `EXDEV` in POSIX.
         */
    	cross_device = 36,
    }

    /**
     * File or memory access pattern advisory information.
     */
    export enum advice {
    	/**
         * The application has no advice to give on its behavior with respect
         * to the specified data.
         */
    	normal = 0,

    	/**
         * The application expects to access the specified data sequentially
         * from lower offsets to higher offsets.
         */
    	sequential = 1,

    	/**
         * The application expects to access the specified data in a random
         * order.
         */
    	random = 2,

    	/**
         * The application expects to access the specified data in the near
         * future.
         */
    	will_need = 3,

    	/**
         * The application expects that it will not access the specified data
         * in the near future.
         */
    	dont_need = 4,

    	/**
         * The application expects to access the specified data once and then
         * not reuse it thereafter.
         */
    	no_reuse = 5,
    }

    /**
     * A descriptor is a reference to a filesystem object, which may be a file,
     * directory, named pipe, special file, or other object on which filesystem
     * calls may be made.
     *
     * This [represents a resource](https://github.com/WebAssembly/WASI/blob/main/docs/WitInWasi.md#Resources).
     */
    export type descriptor = u32;

    export declare function read_via_stream($this: descriptor, offset: filesize): result<input_stream, error_code>;

    export declare function write_via_stream($this: descriptor, offset: filesize): result<output_stream, error_code>;

    export declare function append_via_stream($this: descriptor): result<output_stream, error_code>;

    export declare function advise($this: descriptor, offset: filesize, length: filesize, advice: advice): result<void, error_code>;

    export declare function sync_data($this: descriptor): result<void, error_code>;

    export declare function get_flags($this: descriptor): result<descriptor_flags, error_code>;

    export declare function get_type($this: descriptor): result<descriptor_type, error_code>;

    export declare function set_size($this: descriptor, size: filesize): result<void, error_code>;

    export declare function set_times($this: descriptor, data_access_timestamp: new_timestamp, data_modification_timestamp: new_timestamp): result<void, error_code>;

    export declare function read($this: descriptor, length: filesize, offset: filesize): result<[Uint8Array, boolean], error_code>;

    export declare function write($this: descriptor, buffer: Uint8Array, offset: filesize): result<filesize, error_code>;

    export declare function read_directory($this: descriptor): result<directory_entry_stream, error_code>;

    export declare function sync($this: descriptor): result<void, error_code>;

    export declare function create_directory_at($this: descriptor, path: string): result<void, error_code>;

    export declare function stat($this: descriptor): result<descriptor_stat, error_code>;

    export declare function stat_at($this: descriptor, path_flags: path_flags, path: string): result<descriptor_stat, error_code>;

    export declare function set_times_at($this: descriptor, path_flags: path_flags, path: string, data_access_timestamp: new_timestamp, data_modification_timestamp: new_timestamp): result<void, error_code>;

    export declare function link_at($this: descriptor, old_path_flags: path_flags, old_path: string, new_descriptor: descriptor, new_path: string): result<void, error_code>;

    export declare function open_at($this: descriptor, path_flags: path_flags, path: string, open_flags: open_flags, flags: descriptor_flags, modes: modes): result<descriptor, error_code>;

    export declare function readlink_at($this: descriptor, path: string): result<string, error_code>;

    export declare function remove_directory_at($this: descriptor, path: string): result<void, error_code>;

    export declare function rename_at($this: descriptor, old_path: string, new_descriptor: descriptor, new_path: string): result<void, error_code>;

    export declare function symlink_at($this: descriptor, old_path: string, new_path: string): result<void, error_code>;

    export declare function access_at($this: descriptor, path_flags: path_flags, path: string, type: access_type): result<void, error_code>;

    export declare function unlink_file_at($this: descriptor, path: string): result<void, error_code>;

    export declare function change_file_permissions_at($this: descriptor, path_flags: path_flags, path: string, modes: modes): result<void, error_code>;

    export declare function change_directory_permissions_at($this: descriptor, path_flags: path_flags, path: string, modes: modes): result<void, error_code>;

    export declare function lock_shared($this: descriptor): result<void, error_code>;

    export declare function lock_exclusive($this: descriptor): result<void, error_code>;

    export declare function try_lock_shared($this: descriptor): result<void, error_code>;

    export declare function try_lock_exclusive($this: descriptor): result<void, error_code>;

    export declare function unlock($this: descriptor): result<void, error_code>;

    export declare function drop_descriptor($this: descriptor): void;

    /**
     * A stream of directory entries.
     *
     * This [represents a stream of `dir-entry`](https://github.com/WebAssembly/WASI/blob/main/docs/WitInWasi.md#Streams).
     */
    export type directory_entry_stream = u32;

    export declare function read_directory_entry($this: directory_entry_stream): result<option<directory_entry>, error_code>;

    export declare function drop_directory_entry_stream($this: directory_entry_stream): void;
    export namespace $cm {
    	const $input_stream: $wcm.ComponentModelType<input_stream> = streams.$cm.$input_stream;
    	const $output_stream: $wcm.ComponentModelType<output_stream> = streams.$cm.$output_stream;
    	const $datetime: $wcm.ComponentModelType<datetime> = wall_clock.$cm.$datetime;
    	export const $filesize: $wcm.ComponentModelType<filesize> = $wcm.u64;
    	export const $descriptor_type = new $wcm.EnumType<descriptor_type>(8);
    	export const $descriptor_flags = new $wcm.FlagsType<descriptor_flags>(['read', 'write', 'file_integrity_sync', 'data_integrity_sync', 'requested_write_sync', 'mutate_directory']);
    	export const $path_flags = new $wcm.FlagsType<path_flags>(['symlink_follow']);
    	export const $open_flags = new $wcm.FlagsType<open_flags>(['create', 'directory', 'exclusive', 'truncate']);
    	export const $modes = new $wcm.FlagsType<modes>(['readable', 'writable', 'executable']);
    	export const $filter = new $wcm.VariantType<filter, filter._ct, filter._vt>([undefined, undefined, new $wcm.ListType<string>($wcm.wstring)], filter._ctor);
    	export const $access_type = new $wcm.VariantType<access_type, access_type._ct, access_type._vt>([$modes, undefined], access_type._ctor);
    	export const $link_count: $wcm.ComponentModelType<link_count> = $wcm.u64;
    	export const $device: $wcm.ComponentModelType<device> = $wcm.u64;
    	export const $inode: $wcm.ComponentModelType<inode> = $wcm.u64;
    	export const $new_timestamp = new $wcm.VariantType<new_timestamp, new_timestamp._ct, new_timestamp._vt>([undefined, undefined, $datetime], new_timestamp._ctor);
    	export const $directory_entry = new $wcm.RecordType<directory_entry>([
    		['inode', new $wcm.OptionType<inode>($inode)], ['type', $descriptor_type], ['name', $wcm.wstring]
    	]);
    	export const $error_code = new $wcm.EnumType<error_code>(37);
    	export const $advice = new $wcm.EnumType<advice>(6);
    	export const $descriptor: $wcm.ComponentModelType<descriptor> = $wcm.u32;
    	export const $descriptor_stat = new $wcm.RecordType<descriptor_stat>([
    		['device', $device], ['inode', $inode], ['type', $descriptor_type], ['link_count', $link_count], ['size', $filesize], ['data_access_timestamp', $datetime], ['data_modification_timestamp', $datetime], ['status_change_timestamp', $datetime]
    	]);
    	export const $directory_entry_stream: $wcm.ComponentModelType<directory_entry_stream> = $wcm.u32;
    	export const $read_via_stream = new $wcm.FunctionSignature('read_via_stream', [
    		['$this', $descriptor], ['offset', $filesize]
    	], new $wcm.ResultType<input_stream, error_code>($input_stream, $error_code));
    	export const $write_via_stream = new $wcm.FunctionSignature('write_via_stream', [
    		['$this', $descriptor], ['offset', $filesize]
    	], new $wcm.ResultType<output_stream, error_code>($output_stream, $error_code));
    	export const $append_via_stream = new $wcm.FunctionSignature('append_via_stream', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<output_stream, error_code>($output_stream, $error_code));
    	export const $advise = new $wcm.FunctionSignature('advise', [
    		['$this', $descriptor], ['offset', $filesize], ['length', $filesize], ['advice', $advice]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $sync_data = new $wcm.FunctionSignature('sync_data', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $get_flags = new $wcm.FunctionSignature('get_flags', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<descriptor_flags, error_code>($descriptor_flags, $error_code));
    	export const $get_type = new $wcm.FunctionSignature('get_type', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<descriptor_type, error_code>($descriptor_type, $error_code));
    	export const $set_size = new $wcm.FunctionSignature('set_size', [
    		['$this', $descriptor], ['size', $filesize]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $set_times = new $wcm.FunctionSignature('set_times', [
    		['$this', $descriptor], ['data_access_timestamp', $new_timestamp], ['data_modification_timestamp', $new_timestamp]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $read = new $wcm.FunctionSignature('read', [
    		['$this', $descriptor], ['length', $filesize], ['offset', $filesize]
    	], new $wcm.ResultType<[Uint8Array, boolean], error_code>(new $wcm.TupleType<[Uint8Array, boolean]>([new $wcm.Uint8ArrayType(), $wcm.bool]), $error_code));
    	export const $write = new $wcm.FunctionSignature('write', [
    		['$this', $descriptor], ['buffer', new $wcm.Uint8ArrayType()], ['offset', $filesize]
    	], new $wcm.ResultType<filesize, error_code>($filesize, $error_code));
    	export const $read_directory = new $wcm.FunctionSignature('read_directory', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<directory_entry_stream, error_code>($directory_entry_stream, $error_code));
    	export const $sync = new $wcm.FunctionSignature('sync', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $create_directory_at = new $wcm.FunctionSignature('create_directory_at', [
    		['$this', $descriptor], ['path', $wcm.wstring]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $stat = new $wcm.FunctionSignature('stat', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<descriptor_stat, error_code>($descriptor_stat, $error_code));
    	export const $stat_at = new $wcm.FunctionSignature('stat_at', [
    		['$this', $descriptor], ['path_flags', $path_flags], ['path', $wcm.wstring]
    	], new $wcm.ResultType<descriptor_stat, error_code>($descriptor_stat, $error_code));
    	export const $set_times_at = new $wcm.FunctionSignature('set_times_at', [
    		['$this', $descriptor], ['path_flags', $path_flags], ['path', $wcm.wstring], ['data_access_timestamp', $new_timestamp], ['data_modification_timestamp', $new_timestamp]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $link_at = new $wcm.FunctionSignature('link_at', [
    		['$this', $descriptor], ['old_path_flags', $path_flags], ['old_path', $wcm.wstring], ['new_descriptor', $descriptor], ['new_path', $wcm.wstring]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $open_at = new $wcm.FunctionSignature('open_at', [
    		['$this', $descriptor], ['path_flags', $path_flags], ['path', $wcm.wstring], ['open_flags', $open_flags], ['flags', $descriptor_flags], ['modes', $modes]
    	], new $wcm.ResultType<descriptor, error_code>($descriptor, $error_code));
    	export const $readlink_at = new $wcm.FunctionSignature('readlink_at', [
    		['$this', $descriptor], ['path', $wcm.wstring]
    	], new $wcm.ResultType<string, error_code>($wcm.wstring, $error_code));
    	export const $remove_directory_at = new $wcm.FunctionSignature('remove_directory_at', [
    		['$this', $descriptor], ['path', $wcm.wstring]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $rename_at = new $wcm.FunctionSignature('rename_at', [
    		['$this', $descriptor], ['old_path', $wcm.wstring], ['new_descriptor', $descriptor], ['new_path', $wcm.wstring]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $symlink_at = new $wcm.FunctionSignature('symlink_at', [
    		['$this', $descriptor], ['old_path', $wcm.wstring], ['new_path', $wcm.wstring]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $access_at = new $wcm.FunctionSignature('access_at', [
    		['$this', $descriptor], ['path_flags', $path_flags], ['path', $wcm.wstring], ['type', $access_type]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $unlink_file_at = new $wcm.FunctionSignature('unlink_file_at', [
    		['$this', $descriptor], ['path', $wcm.wstring]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $change_file_permissions_at = new $wcm.FunctionSignature('change_file_permissions_at', [
    		['$this', $descriptor], ['path_flags', $path_flags], ['path', $wcm.wstring], ['modes', $modes]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $change_directory_permissions_at = new $wcm.FunctionSignature('change_directory_permissions_at', [
    		['$this', $descriptor], ['path_flags', $path_flags], ['path', $wcm.wstring], ['modes', $modes]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $lock_shared = new $wcm.FunctionSignature('lock_shared', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $lock_exclusive = new $wcm.FunctionSignature('lock_exclusive', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $try_lock_shared = new $wcm.FunctionSignature('try_lock_shared', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $try_lock_exclusive = new $wcm.FunctionSignature('try_lock_exclusive', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $unlock = new $wcm.FunctionSignature('unlock', [
    		['$this', $descriptor]
    	], new $wcm.ResultType<void, error_code>(undefined, $error_code));
    	export const $drop_descriptor = new $wcm.FunctionSignature('drop_descriptor', [
    		['$this', $descriptor]
    	]);
    	export const $read_directory_entry = new $wcm.FunctionSignature('read_directory_entry', [
    		['$this', $directory_entry_stream]
    	], new $wcm.ResultType<option<directory_entry>, error_code>(new $wcm.OptionType<directory_entry>($directory_entry), $error_code));
    	export const $drop_directory_entry_stream = new $wcm.FunctionSignature('drop_directory_entry_stream', [
    		['$this', $directory_entry_stream]
    	]);
    }
}
export type filesystem = Pick<typeof filesystem, 'read_via_stream' | 'write_via_stream' | 'append_via_stream' | 'advise' | 'sync_data' | 'get_flags' | 'get_type' | 'set_size' | 'set_times' | 'read' | 'write' | 'read_directory' | 'sync' | 'create_directory_at' | 'stat' | 'stat_at' | 'set_times_at' | 'link_at' | 'open_at' | 'readlink_at' | 'remove_directory_at' | 'rename_at' | 'symlink_at' | 'access_at' | 'unlink_file_at' | 'change_file_permissions_at' | 'change_directory_permissions_at' | 'lock_shared' | 'lock_exclusive' | 'try_lock_shared' | 'try_lock_exclusive' | 'unlock' | 'drop_descriptor' | 'read_directory_entry' | 'drop_directory_entry_stream'>;