/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs';

import * as wit from './wit';
import {
	Visitor, InterfaceItem, UseItem, PackageItem, Identifier, RenameItem, NamedImports,
	Document, TypeItem, Tuple, List, Option, Result, RecordItem, FuncItem, Ty, Borrow, _FuncResult, NamedFuncResult, FuncResult, EnumItem, FlagsItem, VariantItem, Comment, CommentBlock, Node
} from './wit-ast';

const document = wit.parse(fs.readFileSync('./src/filesystem.wit', 'utf8'));

namespace Names {

	const keywords: Map<string, string> = new Map<string, string>([
		['this', '$this'],
		['in', '$in']
	]);

	export function toTs(id: Identifier): string {
		let result = id.value.replace(/-/g, '_');
		if (result[0] === '%') {
			result = result.substring(1);
		}
		return keywords.get(result) ?? result;
	}
}

class Imports {

	public readonly baseTypes: Set<string> = new Set();
	private readonly imports: Map<string, string[]> = new Map();

	constructor() {
	}

	public get size(): number {
		return this.imports.size;
	}

	public addBaseType(name: string): void {
		this.baseTypes.add(name);
	}

	public add(value: string, from: string): void {
		let values = this.imports.get(from);
		if (values === undefined) {
			values = [];
			this.imports.set(from, values);
		}
		values.push(value);
	}

	public entries(): IterableIterator<[string, string[]]> {
		return this.imports.entries();
	}

	public [Symbol.iterator](): IterableIterator<[string, string[]]> {
		return this.imports[Symbol.iterator]();
	}
}

class Code {

	public readonly imports: Imports;
	private readonly source: string[];
	private indent: number;

	constructor() {
		this.imports = new Imports();
		this.source = [];
		this.indent = 0;
	}

	public increaseIndent(): void {
		this.indent += 1;
	}

	public decreaseIndent(): void {
		this.indent -= 1;
	}

	public push(content?: string): void {
		if (content !== undefined) {
			this.source.push(`${new Array(this.indent).fill('    ').join('')}${content}`);
		} else {
			this.source.push('');
		}
	}

	public toString(): string {
		this.source.unshift('');
		for (const [from, values] of this.imports) {
			this.source.unshift(`import { ${values.join(', ')} } from '${from}';`);
		}
		if (this.imports.baseTypes.size > 0) {
			this.source.unshift(`import type { ${Array.from(this.imports.baseTypes).join(', ')} } from '@vscode/wasm-component-model';`);
		}
		this.source.unshift(`import * as $wcm from '@vscode/wasm-component-model';`);
		return this.source.join('\n');
	}
}

interface SymbolInformation {
	getComponentModelName(): string;
}

class LocalSymbol implements SymbolInformation {
	public readonly name: string;

	constructor(name: string) {
		this.name = name;
	}

	public getComponentModelName(): string {
		return `$${this.name}`;
	}
}

class ImportedSymbol implements SymbolInformation {
	public readonly name: string;
	public readonly from: string;
	public readonly original?: string;

	constructor(name: string, from: string, original?: string) {
		this.name = name;
		this.from = from;
		this.original = original;
	}

	public getComponentModelName(): string {
		if (this.original !== undefined) {
			return `${this.from}.$cm.${this.original}`;
		} else {
			return `${this.from}.$cm.${this.name}`;
		}
	}
}

class Symbols {

	private readonly symbols: Map<string, SymbolInformation> = new Map();

	public addLocal(name: string): void {
		this.symbols.set(name, new LocalSymbol(name));
	}

	public addImported(name: string, from: string, original?: string): void {
		this.symbols.set(name, new ImportedSymbol(name, from, original));
	}

	public get(name: string): SymbolInformation | undefined {
		return this.symbols.get(name);
	}
}

namespace ComponentModel {

	export interface Emitter {
		emit(code: Code): void;
	}

	export class record implements Emitter {

		private readonly name: string;
		private readonly fields: [string, string][];

		constructor(name: string) {
			this.name = name;
			this.fields = [];
		}

		public addField(name: string, type: string): void {
			this.fields.push([name, type]);
		}

		public emit(code: Code): void {
			const elements: string[] = [];
			for (const [name, type] of this.fields) {
				elements.push(`['${name}', ${type}]`);
			}
			code.push(`export const $${this.name} = new $wcm.RecordType<${this.name}>([`);
			code.increaseIndent();
			code.push(`${elements.join(', ')}`);
			code.decreaseIndent();
			code.push(`]);`);
		}
	}

	export class tuple implements Emitter {

		private readonly name: string;
		private readonly fields: string[];

		constructor(name: string) {
			this.name = name;
			this.fields = [];
		}

		public addField(type: string): void {
			this.fields.push(type);
		}

		public emit(code: Code): void {
			const elements: string[] = [];
			for (const type of this.fields) {
				elements.push(type);
			}
			code.push(`export const $${this.name} = new $wcm.TupleType<${this.name}>([${elements.join(', ')}]);`);
		}
	}

	export class list implements Emitter {

		private readonly name: string;
		private readonly type: string;

		constructor(name: string, type: string) {
			this.name = name;
			this.type = type;
		}

		public emit(code: Code): void {
			code.push(`export const $${this.name} = new $wcm.ListType<${this.name}>(${this.type});`);
		}
	}

	type Visibility = 'public' | 'private';
	export class type implements Emitter {

		private readonly name: string;
		private readonly type: string;
		private readonly visibility: Visibility;

		constructor(name: string, type: string, visibility: Visibility = 'public') {
			this.name = name;
			this.type = type;
			this.visibility = visibility;
		}

		public emit(code: Code): void {
			if (this.visibility === 'public') {
				code.push(`export const $${this.name}: $wcm.ComponentModelType<${this.name}> = ${this.type};`);
			} else {
				code.push(`const $${this.name}: $wcm.ComponentModelType<${this.name}> = ${this.type};`);
			}
		}
	}

	export class functionSignature implements Emitter {

		private readonly name: string;
		private readonly parameters: [string, string][];
		private returnType: string | undefined;

		constructor(name: string) {
			this.name = name;
			this.parameters = [];
			this.returnType = undefined;
		}

		public addParameter(name: string, type: string): void {
			this.parameters.push([name, type]);
		}

		public setReturnType(type: string): void {
			this.returnType = type;
		}

		public emit(code: Code): void {
			const elements: string[] = [];
			for (const [name, type] of this.parameters) {
				elements.push(`['${name}', ${type}]`);
			}
			if (elements.length === 0) {
				code.push(`export const $${this.name} = new $wcm.FunctionSignature('${this.name}', [], ${this.returnType});`);
			} else {
				code.push(`export const $${this.name} = new $wcm.FunctionSignature('${this.name}', [`);
				code.increaseIndent();
				code.push(`${elements.join(', ')}`);
				code.decreaseIndent();
				if (this.returnType !== undefined) {
					code.push(`], ${this.returnType});`);
				} else {
					code.push(`]);`);
				}
			}
		}
	}

	export class enumeration implements Emitter {
		private readonly name: string;
		private readonly cases: number;

		constructor(name: string, cases: number) {
			this.name = name;
			this.cases = cases;
		}

		public emit(code: Code): void {
			code.push(`export const $${this.name} = new $wcm.EnumType<${this.name}>(${this.cases});`);
		}
	}

	export class flags implements Emitter {
		private readonly name: string;
		private readonly values: string[];

		constructor(name: string) {
			this.name = name;
			this.values = [];
		}

		public addValue(name: string): void {
			this.values.push(name);
		}

		public emit(code: Code): void {
			code.push(`export const $${this.name} = new $wcm.FlagsType<${this.name}>([${this.values.map(value => `'${value}'`).join(', ')}]);`);
		}
	}

	export class variant implements Emitter {
		private readonly name: string;
		private readonly cases: (string | undefined)[];

		constructor(name: string) {
			this.name = name;
			this.cases = [];
		}

		public addMember(name: string | undefined): void {
			this.cases.push(name);
		}

		public emit(code: Code): void {
			code.push(`export const $${this.name} = new $wcm.VariantType<${this.name}, ${this.name}._ct, ${this.name}._vt>([${this.cases.map(value => value === undefined ? 'undefined' : value).join(', ')}], ${this.name}._ctor);`);
		}
	}

	export class TyPrinter implements Visitor {

		private readonly imports: Imports;
		public result: string;

		public static do(node: Ty, imports: Imports): string {
			const visitor = new TyPrinter(imports);
			node.visit(visitor, node);
			return visitor.result;
		}

		public constructor(imports: Imports) {
			this.imports = imports;
			this.result = '';
		}

		visitU8(): boolean {
			this.result = '$wcm.u8';
			return false;
		}

		visitU16(): boolean {
			this.result = '$wcm.u16';
			return false;
		}

		visitU32(): boolean {
			this.result = '$wcm.u32';
			return false;
		}

		visitU64(): boolean {
			this.result = '$wcm.u64';
			return false;
		}

		visitS8(): boolean {
			this.result = '$wcm.s8';
			return false;
		}

		visitS16(): boolean {
			this.result = '$wcm.s16';
			return false;
		}

		visitS32(): boolean {
			this.result = '$wcm.s32';
			return false;
		}

		visitS64(): boolean {
			this.result = '$wcm.s64';
			return false;
		}

		visitFloat32(): boolean {
			this.result = '$wcm.float32';
			return false;
		}

		visitFloat64(): boolean {
			this.result = '$wcm.float64';
			return false;
		}

		visitString(): boolean {
			this.result = '$wcm.wstring';
			return false;
		}

		visitBool(): boolean {
			this.result = '$wcm.bool';
			return false;
		}

		visitChar(): boolean {
			this.result = '$wcm.char';
			return false;
		}

		visitIdentifier(node: Identifier) {
			this.result = `$${Names.toTs(node)}`;
			return false;
		}

		visitTuple(node: Tuple): boolean {
			const tyPrinter = new TypeScript.TyPrinter(this.imports);
			const cmTyPrinter = new ComponentModel.TyPrinter(this.imports);
			const tsElements: string[] = [];
			const cmElements: string[] = [];
			for (const member of node.members) {
				member.visit(tyPrinter, member);
				tsElements.push(tyPrinter.result);
				member.visit(cmTyPrinter, member);
				cmElements.push(cmTyPrinter.result);
			}
			this.result = `new $wcm.TupleType<[${tsElements.join(', ')}]>([${cmElements.join(', ')}])`;
			return false;
		}

		visitList(node: List): boolean {
			const type = TypeScript.TyPrinter.do(node.type, this.imports);
			switch (type) {
				case 'u8':
					this.result = 'new $wcm.Uint8ArrayType()';
					break;
				case 'u16':
					this.result = 'new $wcm.Uint16ArrayType()';
					break;
				case 'u32':
					this.result = 'new $wcm.Uint32ArrayType()';
					break;
				case 'u64':
					this.result = 'new $wcm.BigUint64ArrayType()';
					break;
				case 's8':
					this.result = 'new $wcm.Int8ArrayType();';
					break;
				case 's16':
					this.result = 'new $wcm.Int16ArrayType()';
					break;
				case 's32':
					this.result = 'new $wcm.Int32ArrayType()';
					break;
				case 's64':
					this.result = 'new $wcm.BigInt64ArrayType()';
					break;
				case 'float32':
					this.result = 'new $wcm.Float32ArrayType()';
					break;
				case 'float64':
					this.result = 'new $wcm.Float64ArrayType()';
					break;
				default:
					this.result = `new $wcm.ListType<${type}>(${TyPrinter.do(node.type, this.imports)})`;
					break;
			}
			return false;
		}

		visitOption(node: Option): boolean {
			this.result = `new $wcm.OptionType<${TypeScript.TyPrinter.do(node.type, this.imports)}>(${ComponentModel.TyPrinter.do(node.type, this.imports)})`;
			return false;
		}

		visitResult(node: Result): boolean {
			const tyPrinter = new TypeScript.TyPrinter(this.imports);
			const cmTyPrinter = new ComponentModel.TyPrinter(this.imports);
			let ok = 'void', cmOk = 'undefined', error = 'void', cmError = 'undefined';
			if (node.ok !== undefined && Ty.is(node.ok)) {
				node.ok.visit(tyPrinter, node.ok);
				ok = tyPrinter.result;
				node.ok.visit(cmTyPrinter, node.ok);
				cmOk = cmTyPrinter.result;
			}
			if (node.error !== undefined && Ty.is(node.error)) {
				node.error.visit(tyPrinter, node.error);
				error = tyPrinter.result;
				node.error.visit(cmTyPrinter, node.error);
				cmError = cmTyPrinter.result;
			}
			this.result = `new $wcm.ResultType<${ok}, ${error}>(${cmOk}, ${cmError})`;
			return false;
		}

		visitBorrow(_node: Borrow): boolean {
			return false;
		}
	}

	export class FuncResultPrinter implements Visitor {

		private readonly imports: Imports;
		public result: string;

		public static do(node: _FuncResult, imports: Imports): string {
			const visitor = new FuncResultPrinter(imports);
			node.visit(visitor, node);
			return visitor.result;
		}

		public constructor(imports: Imports) {
			this.imports = imports;
			this.result = '';
		}

		visitFuncResult(node: FuncResult): boolean {
			this.result = TyPrinter.do(node.type, this.imports);
			return false;
		}

		visitNamedFuncResult(_node: NamedFuncResult): boolean {
			return false;
		}
	}
}

class ComponentModelEntries {
	private readonly entries: ComponentModel.Emitter[];

	constructor() {
		this.entries = [];
	}

	public get size(): number {
		return this.entries.length;
	}

	public add(type: ComponentModel.Emitter): void {
		this.entries.push(type);
	}

	public emit(code: Code): void {
		// We need to sort the const declarations otherwise we receive compile error
		// that we reference a var before it is initialized. Since WIT has no cyclic
		// dependencies sorting should be fine. However if they get introduced we need
		// to introduce access functions to delay the construction of the meta model.
		// For now we simply sort functions to the end and hope that type are declared
		// before used.
		const sorted: ComponentModel.Emitter[] = this.entries.sort((a, b) => {
			const aIsFunction = a instanceof ComponentModel.functionSignature;
			const bIsFunction = b instanceof ComponentModel.functionSignature;
			if (aIsFunction && !bIsFunction) {
				return 1;
			} else if (!aIsFunction && bIsFunction) {
				return -1;
			} else {
				return 0;
			}
		});
		for (const type of sorted) {
			type.emit(code);
		}
	}
}

namespace TypeScript {

	export abstract class Emitter<T extends Node = Node> {

		protected readonly node: T;

		constructor(node: T) {
			this.node = node;
		}

		public emit(code: Code): void {
			this.emitDocComment(code, this.node);
		}

		protected emitDocComment(code: Code, node: Node): void {
			const comment = node.comments && node.comments[0];
			if (comment === undefined) {
				return;
			}
			if (Comment.is(comment)) {
				code.push('/**');
				code.push(comment.value.replace('///', ' *'));
				code.push(' */');
			} else if (CommentBlock.is(comment) && comment.members.length > 0) {
				code.push('/**');
				for (const item of comment.members) {
					code.push(item.value.replace('///', ' *'));
				}
				code.push(' */');
			}
		}
	}

	type Visibility = 'public' | 'private';
	export class type extends Emitter<TypeItem> {
		private readonly visibility: Visibility;
		constructor(node: TypeItem, visibility: Visibility = 'public') {
			super(node);
			this.visibility = visibility;
		}

		emit(code: Code): void {
			super.emit(code);
			if (this.visibility === 'public') {
				code.push(`export type ${Names.toTs(this.node.name)} = ${TyPrinter.do(this.node.type, code.imports)};`);
			} else {
				code.push(`type ${Names.toTs(this.node.name)} = ${TyPrinter.do(this.node.type, code.imports)};`);
			}
		}
	}

	export class namedImports extends Emitter<NamedImports> {
		constructor(node: NamedImports) {
			super(node);
		}

		emit(code: Code): void {
			super.emit(code);
			const name = this.node.name;
			const tsName = Names.toTs(name);
			code.imports.add(tsName, `./${name.value}`);
			for (const member of this.node.members) {
				if (Identifier.is(member)) {
					const memberName = Names.toTs(member);
					code.push(`type ${memberName} = ${tsName}.${memberName}`);
				} else if (RenameItem.is(member)) {
					const fromName = Names.toTs(member.from);
					const toName = Names.toTs(member.to);
					code.push(`type ${toName} = ${tsName}.${fromName}`);
				}
			}
		}
	}

	export class literal extends Emitter<RecordItem> {
		constructor(node: RecordItem) {
			super(node);
		}

		emit(code: Code): void {
			super.emit(code);
			const tyPrinter = new TyPrinter(code.imports);
			code.push(`export interface ${Names.toTs(this.node.name)} extends $wcm.JRecord {`);
			code.increaseIndent();
			const members = this.node.members;
			for (let i = 0; i < members.length; i++) {
				const member = members[i];
				this.emitDocComment(code, member);
				code.push(`${Names.toTs(member.name)}: ${tyPrinter.do(member.type)};`);
				if (i < members.length - 1) {
					code.push('');
				}
			}
			code.decreaseIndent();
			code.push(`}`);
		}
	}

	export class functionSignature extends Emitter<FuncItem> {

		constructor(node: FuncItem) {
			super(node);
		}

		public emit(code: Code): void {
			super.emit(code);
			const tyPrinter = new TyPrinter(code.imports);
			const elements: string[] = [];
			const signature = this.node.signature;
			for (const param of signature.params.members) {
				elements.push(`${Names.toTs(param.name)}: ${tyPrinter.do(param.type)}`);
			}
			const returnType = signature.result !== undefined ? TypeScript.FuncResultPrinter.do(signature.result, code.imports) : 'void';
			code.push(`export declare function ${Names.toTs(this.node.name)}(${elements.join(', ')}): ${returnType};`);
		}
	}

	export class enumeration extends Emitter<EnumItem> {
		constructor(node: EnumItem) {
			super(node);
		}

		public emit(code: Code): void {
			super.emit(code);
			code.push(`export enum ${Names.toTs(this.node.name)} {`);
			code.increaseIndent();
			const members = this.node.members;
			for (let i = 0; i < members.length; i++) {
				this.emitDocComment(code, members[i]);
				code.push(`${Names.toTs(members[i])} = ${i},`);
				if (i < members.length - 1) {
					code.push('');
				}
			}
			code.decreaseIndent();
			code.push(`}`);
		}
	}

	export class flags extends Emitter<FlagsItem> {

		constructor(node: FlagsItem) {
			super(node);
		}

		public emit(code: Code): void {
			super.emit(code);
			code.push(`export interface ${Names.toTs(this.node.name)} extends $wcm.JFlags {`);
			code.increaseIndent();
			const members = this.node.members;
			for (let i = 0; i < members.length; i++) {
				this.emitDocComment(code, members[i]);
				code.push(`${Names.toTs(members[i])}: boolean;`);
				if (i < members.length - 1) {
					code.push('');
				}
			}
			code.decreaseIndent();
			code.push(`}`);
		}
	}

	export class variant extends Emitter<VariantItem> {
		constructor(node: VariantItem) {
			super(node);
		}

		public emit(code: Code): void {
			super.emit(code);
			const variantName = Names.toTs(this.node.name);
			const names: string[] = [];
			const types: (string | undefined)[] = [];
			const tyPrinter = new TyPrinter(code.imports);
			for (const member of this.node.members) {
				names.push(Names.toTs(member.name));
				if (member.type !== undefined) {
					types.push(tyPrinter.do(member.type));
				} else {
					types.push(undefined);
				}
			}

			code.push(`export namespace ${variantName} {`);
			code.increaseIndent();
			for (let i = 0; i < names.length; i++) {
				super.emitDocComment(code, this.node.members[i]);
				const name = names[i];
				const type = types[i];
				code.push(`export const ${name} = ${i};`);
				if (type !== undefined) {
					code.push(`export type ${name} = { readonly case: typeof ${name}; readonly value: ${type} } & _common;`);
				} else {
					code.push(`export type ${name} = { readonly case: typeof ${name} } & _common;`);
				}
				code.push('');
			}
			code.push(`export type _ct = ${names.map(value => `typeof ${value}`).join(' | ')};`);
			let needsUndefined = false;
			const items: string[] = [];
			for (const type of types) {
				if (type === undefined) {
					needsUndefined = true;
				} else {
					items.push(type);
				}
			}
			if (needsUndefined) {
				items.push('undefined');
			}
			code.push(`export type _vt = ${items.join(' | ')};`);
			code.push(`type _common = Omit<VariantImpl, 'case' | 'value'>;`);
			code.push(`export function _ctor(c: _ct, v: _vt): ${variantName} {`);
			code.increaseIndent();
			code.push(`return new VariantImpl(c, v) as ${variantName};`);
			code.decreaseIndent();
			code.push(`}`);

			for (let i = 0; i < names.length; i++) {
				const name = names[i];
				const type = types[i];
				if (type !== undefined) {
					code.push(`export function _${name}(value: ${type}): ${name} {`);
					code.increaseIndent();
					code.push(`return new VariantImpl(${name}, value) as ${name};`);
					code.decreaseIndent();
					code.push(`}`);
				} else {
					code.push(`export function _${name}(): ${name} {`);
					code.increaseIndent();
					code.push(`return new VariantImpl(${name}, undefined) as ${name};`);
					code.decreaseIndent();
					code.push(`}`);
				}
			}

			code.push(`class VariantImpl {`);
			code.increaseIndent();
			code.push(`private readonly _case: _ct;`);
			code.push(`private readonly _value?: _vt;`);
			code.push(`constructor(c: _ct, value: _vt) {`);
			code.increaseIndent();
			code.push(`this._case = c;`);
			code.push(`this._value = value;`);
			code.decreaseIndent();
			code.push(`}`);
			code.push(`get case(): _ct {`);
			code.increaseIndent();
			code.push(`return this._case;`);
			code.decreaseIndent();
			code.push(`}`);
			code.push(`get value(): _vt {`);
			code.increaseIndent();
			code.push(`return this._value;`);
			code.decreaseIndent();
			code.push(`}`);
			for (const name of names) {
				code.push(`${name}(): this is ${name} {`);
				code.increaseIndent();
				code.push(`return this._case === ${variantName}.${name};`);
				code.decreaseIndent();
				code.push(`}`);
			}
			// class
			code.decreaseIndent();
			code.push(`}`);
			//namespace
			code.decreaseIndent();
			code.push(`}`);

			code.push(`export type ${variantName} = ${names.map(value => `${variantName}.${value}`).join(' | ')}`);
		}
	}

	export class TyPrinter implements Visitor {

		private readonly imports: Imports;
		public result: string;

		public static do(node: Ty, imports: Imports): string {
			const visitor = new TyPrinter(imports);
			node.visit(visitor, node);
			return visitor.result;
		}

		public constructor(imports: Imports) {
			this.imports = imports;
			this.result = '';
		}

		public do(node: Node): string {
			node.visit(this, node);
			const result = this.result;
			this.result = '';
			return result;
		}

		visitU8(): boolean {
			this.result = 'u8';
			this.imports.addBaseType('u8');
			return true;
		}

		visitU16(): boolean {
			this.result = 'u16';
			this.imports.addBaseType('u16');
			return true;
		}

		visitU32(): boolean {
			this.result = 'u32';
			this.imports.addBaseType('u32');
			return true;
		}

		visitU64(): boolean {
			this.result = 'u64';
			this.imports.addBaseType('u64');
			return true;
		}

		visitS8(): boolean {
			this.result = 's8';
			this.imports.addBaseType('s8');
			return true;
		}

		visitS16(): boolean {
			this.result = 's16';
			this.imports.addBaseType('s16');
			return true;
		}

		visitS32(): boolean {
			this.result = 's32';
			this.imports.addBaseType('s32');
			return true;
		}

		visitS64(): boolean {
			this.result = 's64';
			this.imports.addBaseType('s64');
			return true;
		}

		visitFloat32(): boolean {
			this.result = 'float32';
			this.imports.addBaseType('float32');
			return true;
		}

		visitFloat64(): boolean {
			this.result = 'float64';
			this.imports.addBaseType('float64');
			return true;
		}

		visitString(): boolean {
			this.result = 'string';
			return true;
		}

		visitBool(): boolean {
			this.result = 'boolean';
			return true;
		}

		visitChar(): boolean {
			this.result = 'string';
			return true;
		}

		visitIdentifier(node: Identifier) {
			this.result = Names.toTs(node);
			return true;
		}

		visitTuple(node: Tuple): boolean {
			const elements: string[] = [];
			const tyVisitor = new TyPrinter(this.imports);
			for (let i = 0; i < node.members.length; i++) {
				const member = node.members[i];
				member.visit(tyVisitor, member);
				elements.push(tyVisitor.result);
			}
			this.result = `[${elements.join(', ')}]`;
			return false;
		}

		visitList(node: List): boolean {
			const tyVisitor = new TyPrinter(this.imports);
			node.type.visit(tyVisitor, node.type);
			const type = tyVisitor.result;
			switch (type) {
				case 'u8':
					this.result = 'Uint8Array';
					break;
				case 'u16':
					this.result = 'Uint16Array';
					break;
				case 'u32':
					this.result = 'Uint32Array';
					break;
				case 'u64':
					this.result = 'BigUint64Array';
					break;
				case 's8':
					this.result = 'Int8Array';
					break;
				case 's16':
					this.result = 'Int16Array';
					break;
				case 's32':
					this.result = 'Int32Array';
					break;
				case 's64':
					this.result = 'BigInt64Array';
					break;
				case 'float32':
					this.result = 'Float32Array';
					break;
				case 'float64':
					this.result = 'Float64Array';
					break;
				default:
					this.result = `${tyVisitor.result}[]`;
					break;
			}
			return false;
		}

		visitOption(node: Option): boolean {
			const tyVisitor = new TyPrinter(this.imports);
			node.type.visit(tyVisitor, node.type);
			this.result = `option<${tyVisitor.result}>`;
			this.imports.addBaseType('option');
			return false;
		}

		visitResult(node: Result): boolean {
			const tyVisitor = new TyPrinter(this.imports);
			let ok: string = 'void';
			if (node.ok !== undefined && Ty.is(node.ok)) {
				node.ok.visit(tyVisitor, node.ok);
				ok = tyVisitor.result;
			}
			let error: string = 'void';
			if (node.error !== undefined && Ty.is(node.error)) {
				node.error.visit(tyVisitor, node.error);
				error = tyVisitor.result;
			}
			this.result = `result<${ok}, ${error}>`;
			this.imports.addBaseType('result');
			return false;
		}

		visitBorrow(node: Borrow): boolean {
			const tyVisitor = new TyPrinter(this.imports);
			node.name.visit(tyVisitor, node.name);
			this.result = `borrow<${tyVisitor.result}>`;
			this.imports.addBaseType('borrow');
			return false;
		}
	}

	export class FuncResultPrinter implements Visitor {

		private readonly imports: Imports;
		public result: string;

		public static do(node: _FuncResult, imports: Imports): string {
			const visitor = new FuncResultPrinter(imports);
			node.visit(visitor, node);
			return visitor.result;
		}

		public constructor(imports: Imports) {
			this.imports = imports;
			this.result = '';
		}

		visitFuncResult(node: FuncResult): boolean {
			this.result = TyPrinter.do(node.type, this.imports);
			return false;
		}

		visitNamedFuncResult(_node: NamedFuncResult): boolean {
			return false;
		}
	}
}

class TypeScriptEntries {
	private readonly entries: TypeScript.Emitter[];

	constructor() {
		this.entries = [];
	}

	public get size(): number {
		return this.entries.length;
	}

	public add(type: TypeScript.Emitter): void {
		this.entries.push(type);
	}

	public emit(code: Code): void {
		for (let i = 0; i < this.entries.length; i++) {
			this.entries[i].emit(code);
			if (i < this.entries.length - 1) {
				code.push('');
			}
		}
	}
}

interface InterfaceData {
	symbols: Symbols;
	typeScriptEntries: TypeScriptEntries;
	componentModelEntries: ComponentModelEntries;
	exports: string[];
}

class DocumentVisitor implements Visitor {

	private readonly code: Code;
	private readonly interfaceData: InterfaceData[];

	constructor() {
		this.code = new Code();
		this.interfaceData = [];
	}


	public visitDocument(_node: Document): boolean {
		return true;
	}

	public endVisitDocument(_document: Document): void {
		console.log(this.code.toString());
	}

	public visitPackageItem(_item: PackageItem): boolean {
		return false;
	}

	visitInterfaceItem(item: InterfaceItem): boolean {
		this.interfaceData.push({ symbols: new Symbols(), typeScriptEntries: new TypeScriptEntries(), componentModelEntries: new ComponentModelEntries(), exports: [] });
		for (const member of item.members) {
			member.visit(this, member);
		}
		return false;
	}

	endVisitInterfaceItem(item: InterfaceItem): void {
		const name = Names.toTs(item.name);
		const interfaceData = this.interfaceData.pop();
		if (interfaceData === undefined) {
			throw new Error(`No interface data available`);
		}
		this.code.push(`export namespace ${name} {`);
		this.code.increaseIndent();
		if (interfaceData.typeScriptEntries.size > 0) {
			interfaceData.typeScriptEntries.emit(this.code);
		}
		if (interfaceData.componentModelEntries.size > 0) {
			this.code.push(`export namespace $cm {`);
			this.code.increaseIndent();
			interfaceData.componentModelEntries.emit(this.code);
			this.code.decreaseIndent();
			this.code.push(`}`);
		}
		this.code.decreaseIndent();
		this.code.push(`}`);
		if (interfaceData.exports.length > 0) {
			const name = Names.toTs(item.name);
			this.code.push(`export type ${name} = Pick<typeof ${name}, ${interfaceData.exports.map(value => `'${value}'`).join(' | ')}>;`);
		}
	}

	visitUseItem(item: UseItem): boolean {
		const interfaceData = this.getInterfaceData();
		const importItem = item.importItem;
		if (Identifier.is(importItem)) {
			throw new Error(`Not implemented`);
		} else if (RenameItem.is(importItem)) {
			throw new Error(`Not implemented`);
		} else if (NamedImports.is(importItem)) {
			interfaceData.typeScriptEntries.add(new TypeScript.namedImports(importItem));
			const name = importItem.name;
			const tsName = Names.toTs(name);
			this.code.imports.add(tsName, `./${name.value}`);
			for (const member of importItem.members) {
				if (Identifier.is(member)) {
					const memberName = Names.toTs(member);
					interfaceData.componentModelEntries.add(new ComponentModel.type(memberName, `${tsName}.$cm.$${memberName}`, 'private'));
				} else if (RenameItem.is(member)) {
					const fromName = Names.toTs(member.from);
					const toName = Names.toTs(member.to);
					interfaceData.componentModelEntries.add(new ComponentModel.type(toName, `${tsName}.$cm.$${fromName}`, 'private'));
				}
			}
		}
		return false;
	}

	visitTypeItem(item: TypeItem): boolean {
		const tsName = Names.toTs(item.name);
		const interfaceData = this.getInterfaceData();
		interfaceData.typeScriptEntries.add(new TypeScript.type(item));
		interfaceData.componentModelEntries.add(new ComponentModel.type(tsName, ComponentModel.TyPrinter.do(item.type, this.code.imports)));
		return false;
	}

	visitRecordItem(node: RecordItem): boolean {
		const tsName = Names.toTs(node.name);
		const literal = new TypeScript.literal(node);
		const recordType = new ComponentModel.record(tsName);
		for (const member of node.members) {
			const memberName = Names.toTs(member.name);
			recordType.addField(memberName, ComponentModel.TyPrinter.do(member.type, this.code.imports));
		}
		const interfaceData = this.getInterfaceData();
		interfaceData.typeScriptEntries.add(literal);
		interfaceData.componentModelEntries.add(recordType);
		return false;
	}

	visitFuncItem(node: FuncItem): boolean {
		const interfaceData = this.getInterfaceData();
		const tsName = Names.toTs(node.name);
		const tsSignature = new TypeScript.functionSignature(node);
		const cmSignature = new ComponentModel.functionSignature(tsName);
		const tyPrinter = new TypeScript.TyPrinter(this.code.imports);
		const cmTyPrinter = new ComponentModel.TyPrinter(this.code.imports);
		const signature = node.signature;
		for (const param of signature.params.members) {
			param.type.visit(tyPrinter, param.type);
			param.type.visit(cmTyPrinter, param.type);
			const paramName = Names.toTs(param.name);
			cmSignature.addParameter(paramName, cmTyPrinter.result);
		}
		if (signature.result !== undefined) {
			cmSignature.setReturnType(ComponentModel.FuncResultPrinter.do(signature.result, this.code.imports));
		}
		interfaceData.typeScriptEntries.add(tsSignature);
		interfaceData.componentModelEntries.add(cmSignature);
		interfaceData.exports.push(tsName);
		return false;
	}

	visitEnumItem(node: EnumItem): boolean {
		const interfaceData = this.getInterfaceData();
		const tsName = Names.toTs(node.name);
		const tsEnum = new TypeScript.enumeration(node);
		interfaceData.typeScriptEntries.add(tsEnum);
		interfaceData.componentModelEntries.add(new ComponentModel.enumeration(tsName, node.members.length));
		return false;
	}

	visitFlagsItem(node: FlagsItem): boolean {
		this.code.imports.addBaseType('flags');
		const interfaceData = this.getInterfaceData();
		const tsName = Names.toTs(node.name);
		const tsFlags = new TypeScript.flags(node);
		const cmFlags = new ComponentModel.flags(tsName);
		for (const member of node.members) {
			const name = Names.toTs(member);
			cmFlags.addValue(name);
		}
		interfaceData.typeScriptEntries.add(tsFlags);
		interfaceData.componentModelEntries.add(cmFlags);
		return false;
	}

	visitVariantItem(node: VariantItem): boolean {
		const interfaceData = this.getInterfaceData();
		const tsName = Names.toTs(node.name);
		const tsVariant = new TypeScript.variant(node);
		const cmVariant = new ComponentModel.variant(tsName);
		for (const member of node.members) {
			if (member.type !== undefined) {
				cmVariant.addMember(ComponentModel.TyPrinter.do(member.type, this.code.imports));
			} else {
				cmVariant.addMember(undefined);
			}
		}
		interfaceData.typeScriptEntries.add(tsVariant);
		interfaceData.componentModelEntries.add(cmVariant);
		return false;
	}

	private getInterfaceData(): InterfaceData {
		const result = this.interfaceData[this.interfaceData.length - 1];
		if (result === undefined) {
			throw new Error(`No component model type`);
		}
		return result;
	}
}

const visitor = new DocumentVisitor();
document.visit(visitor, document);