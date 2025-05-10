import { injectable } from 'inversify';
import Parser from 'web-tree-sitter';

import { CodeFile, CodeFunction, CodeStructure, CodeVariable, StructureType } from '../../editor/codemodel/CodeElement';
import { LanguageProfile, LanguageProfileUtil } from '../_base/LanguageProfile';
import { BaseStructurerProvider } from '../_base/StructurerProvider';
import { LanguageIdentifier } from 'base/common/languages/languages';


@injectable()
export class KotlinStructurerProvider extends BaseStructurerProvider {
	protected langId: LanguageIdentifier = 'kotlin';
	protected config: LanguageProfile = LanguageProfileUtil.from(this.langId)!!;
	protected parser: Parser | undefined;
	protected language: Parser.Language | undefined;

	constructor() {
		super();
	}

	isApplicable(lang: string) {
		return lang === this.langId;
	}

	async parseFile(code: string, filepath: string): Promise<CodeFile | undefined> {
		const tree = this.parser!!.parse(code);
		const query = this.config.structureQuery.query(this.language!!);
		const captures = query!!.captures(tree.rootNode);

		let filename = filepath.split('/')[filepath.split('/').length - 1];
		const codeFile: CodeFile = {
			name: filename,
			filepath: filepath,
			language: this.langId,
			functions: [],
			path: '',
			package: '',
			imports: [],
			classes: [],
		};
		let classObj: CodeStructure = this.createEmptyStructure(StructureType.Class);
		let interfaceObj: CodeStructure = this.createEmptyStructure(StructureType.Interface);

		let isLastNode = false;
		let isInInterface = false;
		const methods: CodeFunction[] = [];
		let methodReturnType = '';
		let methodName = '';

		const fields: CodeVariable[] = [];
		let lastField: CodeVariable = this.initVariable();

		for (const element of captures) {
			const capture: Parser.QueryCapture = element!!;
			const text = capture.node.text;

			switch (capture.name) {
				case 'package-name':
					codeFile.package = text;
					break;
				case 'import-name':
					codeFile.imports.push(text);
					break;
				case 'class-name':
					if (classObj.name !== '') {
						classObj.fields = fields.slice();
						classObj.methods = methods.slice();
						codeFile.classes.push({ ...classObj });

						// 重置字段和方法
						methods.length = 0;
						fields.length = 0;
					}

					classObj = this.createEmptyStructure(StructureType.Class);
					classObj.name = text;
					classObj.canonicalName = codeFile.package ? codeFile.package + '.' + classObj.name : classObj.name;
					isInInterface = false;

					const classNode: Parser.SyntaxNode | null = capture.node?.parent ?? null;
					if (classNode !== null) {
						this.insertLocation(classNode, classObj);
						if (!isLastNode) {
							isLastNode = true;
						}
					}
					break;
				case 'interface-name':
					if (interfaceObj.name !== '') {
						interfaceObj.fields = fields.slice();
						interfaceObj.methods = methods.slice();
						codeFile.classes.push({ ...interfaceObj });

						methods.length = 0;
						fields.length = 0;
					}

					interfaceObj = this.createEmptyStructure(StructureType.Interface);
					interfaceObj.name = text;
					interfaceObj.canonicalName = codeFile.package ? codeFile.package + '.' + interfaceObj.name : interfaceObj.name;
					isInInterface = true;

					const interfaceNode: Parser.SyntaxNode | null = capture.node?.parent ?? null;
					if (interfaceNode !== null) {
						this.insertLocation(interfaceNode, interfaceObj);
						if (!isLastNode) {
							isLastNode = true;
						}
					}
					break;
				case 'extend-name':
					if (isInInterface) {
						interfaceObj.extends?.push(text);
					} else {
						classObj.extends?.push(text);
					}
					break;
				case 'implements-name':
					classObj.implements.push(text);
					break;
				case 'method-name':
				case 'interface-method-name':
					methodName = text;
					break;
				case 'method-body':
				case 'interface-method-body':
					if (methodName !== '') {
						const methodNode = capture.node;
						const methodObj = this.createFunction(capture.node, methodName);
						if (methodReturnType !== '') {
							methodObj.returnType = methodReturnType;
							}

						methods.push(methodObj);
					}

					methodReturnType = '';
					methodName = '';
					break;
				case 'field-name':
				case 'interface-property-name':
					lastField = this.initVariable();
					lastField.name = text;
					break;
				case 'field-type':
				case 'interface-property-type':
					if (lastField.name) {
						lastField.type = text;
						fields.push({ ...lastField });
						lastField = this.initVariable();
					}
					break;
				case 'field-value':
					if (lastField.name) {
						lastField.type = text;
					}
					break;
				default:
					break;
			}
		}

		// 处理最后一个类或接口
		if (isInInterface && interfaceObj.name !== '') {
			interfaceObj.fields = fields;
			interfaceObj.methods = methods;
			codeFile.classes.push({ ...interfaceObj });
		} else if (!isInInterface && classObj.name !== '') {
			classObj.fields = fields;
			classObj.methods = methods;
			codeFile.classes.push({ ...classObj });
		}

		return this.combineSimilarClasses(codeFile);
	}

	// 创建空的结构对象
	private createEmptyStructure(type: StructureType): CodeStructure {
		return {
			type: type,
			canonicalName: '',
			constant: [],
			extends: [],
			methods: [],
			name: '',
			package: '',
			implements: [],
			fields: [],
			end: { row: 0, column: 0 },
			start: { row: 0, column: 0 }
		}
	}
}
