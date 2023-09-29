/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export interface Document {
	worlds: World[];
	interfaces: Interface[];
	types: Type[];
	packages: Package[];
}

export interface World {
	name: string;
	docs?: Documentation | undefined;
	imports: NameMap<ObjectKind>;
	exports: NameMap<ObjectKind>;
	package: number;
}
export namespace World {
	export function is(value: any): value is World {
		return typeof value === 'object'
			&& typeof value.name === 'string'
			&& typeof value.imports === 'object'
			&& typeof value.exports === 'object'
			&& typeof value.package === 'number';
	}
}

export interface Documentation {
	contents: string | null;
}
export interface Interface {
	name: string;
	docs?: Documentation;
	types: References;
	functions: NameMap<Func>;
	package: number;
}
export namespace Interface {
	export function is(value: any): value is Interface {
		return typeof value === 'object'
			&& typeof value.name === 'string'
			&& typeof value.types === 'object'
			&& typeof value.functions === 'object'
			&& typeof value.package === 'number';
	}
}

export interface Func {
	name: string;
	docs?: Documentation | undefined;
	kind: 'freestanding';
	params: Param[];
	results: TypeObject[];
}

export interface Type {
	name: string | null;
	docs?: Documentation | undefined;
	kind: TypeKind;
	owner: Owner | null;
}

export interface Package {
	name: string;
	docs?: Documentation | undefined;
	interfaces: References;
	worlds: References;
}

export type Owner = { world: number } | { interface: number };
export enum OwnerKind {
	World = 'world',
	Interface = 'interface',
}
export namespace Owner {
	export function isWorld(owner: Owner): owner is { world: number } {
		return typeof (owner as { world: number }).world === 'number';
	}
	export function isInterface(owner: Owner): owner is { interface: number } {
		return typeof (owner as { interface: number }).interface === 'number';
	}
	export function resolve(owner: Owner, symbols: Pick<Document, 'interfaces' | 'worlds'>): Interface | World {
		if (isWorld(owner)) {
			return symbols.worlds[owner.world];
		} else if (isInterface(owner)) {
			return symbols.interfaces[owner.interface];
		} else {
			throw new Error(`Unknown owner kind ${JSON.stringify(owner)}`);
		}
	}
	export function kind(owner: Owner): OwnerKind {
		if (isWorld(owner)) {
			return OwnerKind.World;
		} else if (isInterface(owner)) {
			return OwnerKind.Interface;
		} else {
			throw new Error(`Unknown owner kind ${JSON.stringify(owner)}`);
		}
	}
}

export type TypeKind = TypeObject | Record | Variant | Enum | Flags | Tuple | List | Option | Result;
export namespace TypeKind {
	export function isBaseType(kind: TypeKind): kind is { type: string } {
		return typeof (kind as BaseType).type === 'string';
	}
	export function isTypeReference(kind: TypeKind): kind is { type: number } {
		return typeof (kind as { type: number }).type === 'number';
	}
	export function isTypeObject(kind: TypeKind): kind is TypeObject {
		const candidate = kind as TypeObject;
		return typeof candidate.type === 'number' || typeof candidate.type === 'string';
	}
	export function isRecord(kind: TypeKind): kind is Record {
		return typeof (kind as Record).record === 'object';
	}
	export function isVariant(kind: TypeKind): kind is Variant {
		const candidate = kind as Variant;
		return typeof candidate.variant === 'object';
	}
	export function isEnum(kind: TypeKind): kind is Enum {
		const candidate = kind as Enum;
		return typeof candidate.enum === 'object';
	}
	export function isFlags(kind: TypeKind): kind is Flags {
		const candidate = kind as Flags;
		return typeof candidate.flags === 'object';
	}
	export function isTuple(kind: TypeKind): kind is Tuple {
		const candidate = kind as Tuple;
		return typeof candidate.tuple === 'object';
	}
	export function isList(kind: TypeKind): kind is List {
		const candidate = kind as List;
		return typeof candidate.list === 'number' || typeof candidate.list === 'string';
	}
	export function isOption(kind: TypeKind): kind is Option {
		const candidate = kind as Option;
		return typeof candidate.option === 'number' || typeof candidate.option === 'string';
	}
	export function isResult(kind: TypeKind): kind is Result {
		const candidate = kind as Result;
		const ok = candidate.result?.ok;
		const err = candidate.result?.err;
		return (ok !== undefined && (typeof ok === 'number' || typeof ok === 'string' || ok === null))
			&& (err !== undefined && (typeof err === 'number' || typeof err === 'string' || err === null));
	}
}

export interface Record {
	record: {
		fields: Field[];
	};
}

export interface Field {
	name: string;
	docs: Documentation;
	type: TypeReference;
}

export interface Variant {
	variant: {
		cases: VariantCase[];
	};
}

export interface VariantCase {
	name: string;
	docs: Documentation;
	type: TypeReference | null;
}

export interface Enum {
	enum: {
		cases: EnumCase[];
	};
}

export interface EnumCase {
	name: string;
	docs: Documentation;
}

export interface Flags {
	flags: {
		flags: Flag[];
	};
}

export interface Flag {
	name: string;
	docs: Documentation;
}

export interface Tuple {
	tuple: {
		types: TypeReference[];
	};
}

export interface List {
	list: TypeReference;
}

export interface Option {
	option: TypeReference;
}

export interface Result {
	result: {
		ok: TypeReference | null;
		err: TypeReference | null;
	};
}

export interface BaseType {
	type: string;
}

export interface TypeObject {
	type: number | string;
}

export interface FuncObject {
	function: Func;
}

export interface InterfaceObject {
	interface: number;
}

export type ObjectKind = TypeObject | FuncObject | InterfaceObject;
export namespace ObjectKind {
	export function isTypeObject(kind: ObjectKind): kind is TypeObject {
		return typeof (kind as TypeObject).type === 'number';
	}
	export function isFuncObject(kind: ObjectKind): kind is FuncObject {
		return typeof (kind as FuncObject).function === 'object';
	}
	export function isInterfaceObject(kind: ObjectKind): kind is InterfaceObject {
		return typeof (kind as InterfaceObject).interface === 'number';
	}
}

export type TypeReference = number | string;
export namespace TypeReference {
	export function isNumber(ref: TypeReference): ref is number {
		return typeof ref === 'number';
	}
	export function isString(ref: TypeReference): ref is string {
		return typeof ref === 'string';
	}
}

export interface Param {
	name: string;
	type: TypeReference;
}

export type References = NameMap<number>;

export interface NameMap<T> {
	[name: string]: T;
}